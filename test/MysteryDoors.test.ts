import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm as mockFhevm } from "hardhat";
import { createInstance, loadTestnetConfig, loadWallet, timestampLog } from "../tasks/utils";
import { JsonRpcProvider, HDNodeWallet, Signer } from "ethers";
import { DecryptedResults, FhevmInstance } from "@zama-fhe/relayer-sdk/node";
import { HardhatFhevmRuntimeEnvironment, FhevmType } from "@fhevm/hardhat-plugin";
import { MysteryDoors, MysteryDoors__factory } from "../typechain-types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

type Coord = {
  x: number;
  y: number;
};

const MAX_GUESSES = 5;

async function deployFixture() {
  const networkName = process.env.NETWORK || "hardhat";
  let wallet: HDNodeWallet;
  let contractFactory: MysteryDoors__factory;
  let walletAddress: string;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  timestampLog("Network name: " + networkName);
  const configFile = "mocked_config.json";
  if (networkName !== "hardhat") {
    throw new Error("Can only be run on hardhat")
  } else {
    timestampLog("Running on hardhat, using mocked config");
    const signers = await ethers.getSigners();
    wallet = signers[0];
    walletAddress = wallet.address;
  }

  timestampLog("Loading testnet config")
  const testnetConfig = await loadTestnetConfig(configFile);
  timestampLog("Connecting provider")

  const provider = ethers.getDefaultProvider(testnetConfig.jsonRpcUrl) as JsonRpcProvider;

  contractFactory = await ethers.getContractFactory("MysteryDoors") as unknown as MysteryDoors__factory;
  timestampLog("Using mock fhevm");
  fhevm = mockFhevm;


  timestampLog("Deploying contract")
  const mysteryDoorsContract = await contractFactory.deploy(
    ethers.getAddress(testnetConfig.aclContractAddress),
    ethers.getAddress(testnetConfig.fhevmExecutorContractAddress),
    ethers.getAddress(testnetConfig.kmsVerifierContractAddress),
    ethers.getAddress(testnetConfig.decryptionOracleContractAddress),
  );
  timestampLog("Waiting for deployment...")
  const receipt = await (await mysteryDoorsContract.waitForDeployment()).deploymentTransaction()?.wait()
  timestampLog("Contract deployed at block: " + receipt?.blockNumber);
  const mysteryDoorsContractAddress = receipt?.contractAddress as string;
  timestampLog("Contract address: " + mysteryDoorsContractAddress)

  return { mysteryDoorsContract, mysteryDoorsContractAddress, wallet, walletAddress, fhevm };
}

async function setupUserDecrypt(instance: HardhatFhevmRuntimeEnvironment, signer: HDNodeWallet, ciphertextHandles: string[], contractAddress: string): Promise<DecryptedResults> {
  // instance: [`FhevmInstance`] from `zama-fhe/relayer-sdk`
  // signer: [`Signer`] from ethers (could a [`Wallet`])
  // ciphertextHandle: [`string`]
  // contractAddress: [`string`]

  timestampLog("Generating keypair...")

  const keypair = instance.generateKeypair();
  const handleContractPairs = ciphertextHandles.map((ciphertextHandle) => {
    return {
      handle: ciphertextHandle,
      contractAddress: contractAddress,
    };
  });
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = '10'; // String for consistency
  const contractAddresses = [contractAddress];

  timestampLog("Creating EIP712...")
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimeStamp,
    durationDays,
  );

  timestampLog(`Signer ${signer.address} sign typed data...`)

  const signature = await signer.signTypedData(
    eip712.domain,
    {
      UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
    },
    eip712.message,
  );

  timestampLog("User decrypt...")

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace('0x', ''),
    contractAddresses,
    signer.address,
    startTimeStamp,
    durationDays,
  );
  return result;
}

describe("MysteryDoors", function () {
  let signers: Signers;
  let mysteryDoorsContract: MysteryDoors;
  let mysteryDoorsContractAddress: string;
  let wallet: HDNodeWallet;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  let walletAddress: string;
  let occupiedPositions: number[];


  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ mysteryDoorsContract, mysteryDoorsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
    occupiedPositions = [24, 23, 22, 17, 12]; // L

    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, walletAddress);
    input.add8(occupiedPositions[0]);
    input.add8(occupiedPositions[1]);
    input.add8(occupiedPositions[2]);
    input.add8(occupiedPositions[3]);
    input.add8(occupiedPositions[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
    await mysteryDoorsContract.startGame();
  });

  it("Leaderboard with no players", async () => {
    const [playersList, ePlayerCorrectGuessesList, playerNamesList] = await mysteryDoorsContract.connect(signers.deployer).getPlayersCorrectGuesses();
    expect(ePlayerCorrectGuessesList).to.have.length(0);
    expect(playersList).to.have.length(0);
    const result = await setupUserDecrypt(fhevm, wallet, ePlayerCorrectGuessesList, mysteryDoorsContractAddress);

    const playerNumCorrectGuesses: Record<string, number> = {};
    let handleIndex = 0;
    for (const key in result) {
      playerNumCorrectGuesses[`${playersList[handleIndex]}: ${playerNamesList[handleIndex]}`] = result[key] as bigint as unknown as number;
      handleIndex++;
    }
    console.log(playerNumCorrectGuesses);
  });

  it("Players cannot join the game multiple times", async () => {
    const positionGuesses = [17, 4, 2, 21, 6];

    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, signers.alice.address);
    input.add8(positionGuesses[0]);
    input.add8(positionGuesses[1]);
    input.add8(positionGuesses[2]);
    input.add8(positionGuesses[3]);
    input.add8(positionGuesses[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.connect(signers.alice).joinGame("Alice");
    await mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
    await expect(mysteryDoorsContract.connect(signers.alice).joinGame("Alice")).to.be.revertedWith("You have already joined the game!");
  });

  it("Player needs to have joined the game", async () => {
    const positionGuesses = [17, 4, 2, 21, 6];

    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, signers.alice.address);
    input.add8(positionGuesses[0]);
    input.add8(positionGuesses[1]);
    input.add8(positionGuesses[2]);
    input.add8(positionGuesses[3]);
    input.add8(positionGuesses[4]);
    const encryptedInput = await input.encrypt();
    await expect(mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof)).to.be.revertedWith("You have not joined the game!");
    await mysteryDoorsContract.connect(signers.alice).joinGame("Alice");
    await expect(mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof)).not.to.be.reverted;
  });

  it("Player should not submit guesses multiple times", async () => {
    const positionGuesses = [17, 4, 2, 21, 6];

    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, signers.alice.address);
    input.add8(positionGuesses[0]);
    input.add8(positionGuesses[1]);
    input.add8(positionGuesses[2]);
    input.add8(positionGuesses[3]);
    input.add8(positionGuesses[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.connect(signers.alice).joinGame("Alice");
    await expect(mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof)).not.to.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof)).to.be.revertedWith("You have already submitted your guesses!");

  });

  it("Player should be able to decrypt their guesses", async () => {
    const positionGuesses = [17, 4, 2, 21, 6];

    await mysteryDoorsContract.connect(signers.alice).joinGame("Alice");
    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, signers.alice.address);
    input.add8(positionGuesses[0]);
    input.add8(positionGuesses[1]);
    input.add8(positionGuesses[2]);
    input.add8(positionGuesses[3]);
    input.add8(positionGuesses[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);

    const playerGuesses = await mysteryDoorsContract.connect(signers.alice).getGuesses();
    expect(playerGuesses).to.have.length(MAX_GUESSES);
    for (let i = 0; i < playerGuesses.length; i++) {
      const decryptedGuess = await fhevm.userDecryptEuint(FhevmType.euint8, playerGuesses[i], mysteryDoorsContractAddress, signers.alice);
      expect(decryptedGuess).to.equal(positionGuesses[i]);
    }
  });

  it("Player should be able to decrypt the number of correct guesses", async () => {
    const positionGuesses = [17, 4, 2, 21, 6];

    await mysteryDoorsContract.connect(signers.alice).joinGame("Alice");
    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, signers.alice.address);
    input.add8(positionGuesses[0]);
    input.add8(positionGuesses[1]);
    input.add8(positionGuesses[2]);
    input.add8(positionGuesses[3]);
    input.add8(positionGuesses[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.connect(signers.alice).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);

    const eCorrectGuesses = await mysteryDoorsContract.connect(signers.alice).getCorrectGuesses();
    const correctGuesses = await fhevm.userDecryptEuint(FhevmType.euint8, eCorrectGuesses, mysteryDoorsContractAddress, signers.alice);
    expect(correctGuesses).to.eq(1);

  });

  it("Multi players and their winning guesses", async () => {
    type Player = {
      name: string;
      signer: HardhatEthersSigner;
      guesses: number[];
      expectedCorrectGuesses: number;
    }
    const players: Player[] = [{ name: "Alice", signer: signers.alice, guesses: [17, 4, 2, 21, 6], expectedCorrectGuesses: 1 }, { name: "Bob", signer: signers.bob, guesses: [10, 16, 23, 22, 21], expectedCorrectGuesses: 2 }];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const positionGuesses = player.guesses;
      await mysteryDoorsContract.connect(player.signer).joinGame(player.name);

      const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, player.signer.address);
      input.add8(positionGuesses[0]);
      input.add8(positionGuesses[1]);
      input.add8(positionGuesses[2]);
      input.add8(positionGuesses[3]);
      input.add8(positionGuesses[4]);
      const encryptedInput = await input.encrypt();
      await mysteryDoorsContract.connect(player.signer).makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
      const eCorrectGuesses = await mysteryDoorsContract.connect(player.signer).getCorrectGuesses();
      const correctGuesses = await fhevm.userDecryptEuint(FhevmType.euint8, eCorrectGuesses, mysteryDoorsContractAddress, player.signer);
      expect(correctGuesses).to.eq(player.expectedCorrectGuesses);
    }


    await mysteryDoorsContract.connect(signers.deployer).endGame();
    const [playersList, ePlayerCorrectGuessesList, playerNamesList] = await mysteryDoorsContract.connect(signers.deployer).getPlayersCorrectGuesses();
    const result = await setupUserDecrypt(fhevm, wallet, ePlayerCorrectGuessesList, mysteryDoorsContractAddress);
    timestampLog("Result:");
    expect(playerNamesList.length).to.equal(playersList.length);
    const playerNumCorrectGuesses: Record<string, bigint> = {};
    let handleIndex = 0;
    for (const key in result) {
      playerNumCorrectGuesses[`${playersList[handleIndex]}: ${playerNamesList[handleIndex]}`] = result[key] as bigint;
      handleIndex++;
    }
    expect(Object.keys(playerNumCorrectGuesses).length).to.eq(playersList.length);
    console.log(playerNumCorrectGuesses);
    expect(playerNumCorrectGuesses[`${playersList[0]}: Alice`]).to.eq(players[0].expectedCorrectGuesses);
    expect(playerNumCorrectGuesses[`${playersList[1]}: Bob`]).to.eq(players[1].expectedCorrectGuesses);
  });

  it("Occupied positions should not be publicly decryptable before the game ends", async () => {
    await expect(mysteryDoorsContract.connect(signers.bob).getOccupiedPositions()).to.be.revertedWith("The game has not ended yet.");
    await expect(mysteryDoorsContract.connect(signers.deployer).endGame()).to.not.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.bob).getOccupiedPositions()).to.not.be.reverted;
  });

  it("Occupied positions should be publicly decryptable after the game ends", async () => {
    await expect(mysteryDoorsContract.connect(signers.bob).getOccupiedPositions()).to.be.revertedWith("The game has not ended yet.");
    await expect(mysteryDoorsContract.connect(signers.deployer).endGame()).to.not.be.reverted;

    const occupiedPositionsHandles = await mysteryDoorsContract.connect(signers.bob).getOccupiedPositions();
    const decryptedHandles = await fhevm.publicDecrypt(occupiedPositionsHandles);
    const dOccupiedPositions: number[] = [];
    for (let key in decryptedHandles) {
      const decryptedValue = decryptedHandles[key];
      dOccupiedPositions.push(decryptedValue as unknown as number);
    }
    expect(dOccupiedPositions).to.deep.eq(occupiedPositions);

  });
});

describe("MysteryDoors before game start", function () {
  let signers: Signers;
  let mysteryDoorsContract: MysteryDoors;
  let mysteryDoorsContractAddress: string;
  let wallet: HDNodeWallet;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  let walletAddress: string;


  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ mysteryDoorsContract, mysteryDoorsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
    const occupiedPositions = [24, 23, 22, 17, 12]; // L

    const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, walletAddress);
    input.add8(occupiedPositions[0]);
    input.add8(occupiedPositions[1]);
    input.add8(occupiedPositions[2]);
    input.add8(occupiedPositions[3]);
    input.add8(occupiedPositions[4]);
    const encryptedInput = await input.encrypt();
    await mysteryDoorsContract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
  });

  it("Only deployer can end the game", async () => {
    await mysteryDoorsContract.connect(signers.deployer).startGame();

    await expect(mysteryDoorsContract.connect(signers.alice).endGame()).to.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.bob).endGame()).to.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.deployer).endGame()).to.not.be.reverted;
  });

  it("Only deployer can start the game", async () => {
    await expect(mysteryDoorsContract.connect(signers.alice).startGame()).to.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.bob).startGame()).to.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.deployer).startGame()).to.not.be.reverted;
  });

  it("The game can only be started once", async () => {
    await expect(mysteryDoorsContract.connect(signers.deployer).startGame()).to.not.be.reverted;
    await expect(mysteryDoorsContract.connect(signers.deployer).startGame()).to.be.revertedWith("The game has already started.");

  });


  describe("MysteryDoors no init", function () {
    let signers: Signers;
    let mysteryDoorsContract: MysteryDoors;
    let mysteryDoorsContractAddress: string;
    let wallet: HDNodeWallet;
    let fhevm: HardhatFhevmRuntimeEnvironment;
    let walletAddress: string;


    before(async function () {
      const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
      signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    });

    beforeEach(async () => {
      ({ mysteryDoorsContract, mysteryDoorsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());

    });

    it("Returns the contract owner", async () => {
      const owner = signers.deployer.address
      const deployerCall = await mysteryDoorsContract.connect(signers.deployer).owner();
      const bobCall = await mysteryDoorsContract.connect(signers.bob).owner();
      expect(deployerCall).to.equal(owner);
      expect(bobCall).to.equal(owner);
    });


    it("The game can only be started when the occupied positions are set", async () => {
      await expect(mysteryDoorsContract.connect(signers.deployer).startGame()).to.be.revertedWith("The occupied positions haven't been set!");
      const occupiedPositions = [24, 23, 22, 17, 12]; // L

      const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, walletAddress);
      input.add8(occupiedPositions[0]);
      input.add8(occupiedPositions[1]);
      input.add8(occupiedPositions[2]);
      input.add8(occupiedPositions[3]);
      input.add8(occupiedPositions[4]);
      const encryptedInput = await input.encrypt();
      await mysteryDoorsContract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);

      await expect(mysteryDoorsContract.connect(signers.deployer).startGame()).to.not.be.reverted;

    });

    it("The occupied doors can only be set once", async () => {
      const occupiedPositions = [24, 23, 22, 17, 12]; // L

      const input = fhevm.createEncryptedInput(mysteryDoorsContractAddress, walletAddress);
      input.add8(occupiedPositions[0]);
      input.add8(occupiedPositions[1]);
      input.add8(occupiedPositions[2]);
      input.add8(occupiedPositions[3]);
      input.add8(occupiedPositions[4]);
      const encryptedInput = await input.encrypt();
      await mysteryDoorsContract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
      await mysteryDoorsContract.connect(signers.deployer).startGame();
      await expect(mysteryDoorsContract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof)).to.be.revertedWith("Occupied doors can only be marked before the game starts!");

    });

  });
});