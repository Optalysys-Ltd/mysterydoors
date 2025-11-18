import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
      <div className="max-w-6xl mx-auto p-6 text-gray-900 prose">
        <h1>Welcome to Mystery Doors dApp!</h1>
        <p>Open the link below to access the Mystery Doors dApp</p>
        <p><Link href="/mysterydoors"><button className="btn btn-lg btn-primary">MysteryDoors</button></Link></p>
        <h2>Instructions</h2>
        <h3>Add Optalysys network to MetaMask</h3>
        <p>Add the networks to MetaMask using these values:</p>
        <h4>CPU testnet</h4>
        <div>JSON RPC URL: <code>https://rpc.gcp-testnet-eth.dev.optalysys.com</code></div>
        <div>Chain ID: <code>678259798</code></div>

        <h4>Blue (FPGA-accelerated) testnet</h4>
        <div>JSON RPC URL: <code>https://rpc.gcp-testnet-eth.blue.optalysys.com/</code></div>
        <div>Chain ID: <code>678259799</code></div>

        <img src="./instructions/metamask_add_network.png" alt="Add network to Metamask" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />

        <h3>Add account by importing the private key</h3>
        <p>Choose Add Account and import the Optalysys private key by scanning the QR code or typing it in.</p>
        <img src="./instructions/metamask_add_account.png" alt="Add account to Metamask" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <img src="./instructions/metamask_import_account.png" alt="Import account to Metamask" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <img src="./instructions/metamask_import_private_key.png" alt="Import private key to Metamask" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />

        <p><strong>Use the MetaMask in-built browser to access the dApp!</strong></p>
        <h2>Go to the Mystery Doors dApp</h2>
        <p>Open the link below to access the Mystery Doors dApp</p>
        <p><Link href="/mysterydoors"><button className="btn btn-lg btn-primary">MysteryDoors</button></Link></p>
        <p>Connect your wallet to the Mystery Doors dApp using WalletConnect and MetaMask. WalletConnect is a more reliable way of using MetaMask as the MetaMask requests do not disappear.</p>
        <img src="./instructions/connect_wallet_connect.png" alt="WalletConnect connect account to Mystery Doors dApp" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <p>Select MetaMask in Wallet Connect.</p>
        <img src="./instructions/connect_wallet_connect_metamask.png" alt="WalletConnect MetaMask connect account to Mystery Doors dApp" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <p>Connect your wallet to the Mystery Doors dApp</p>
        <img src="./instructions/metamask_connect_account.png" alt="Metamask connect account to Mystery Doors dApp" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />

        <p>Switch network to Optalysys dev or Optalysys Blue.</p>
        <p>Note: In the event of multiple entries by the same wallet, the entry submitted on Optalysys Blue will be the wallet's <em>definitive</em> submission.</p>
        <p>Check the debug status showing the FHEVM instance is <strong>connected</strong>.</p>
        <p>Join the game by entering your name and clicking/pressing Join Game.</p>
        <img src="./instructions/join_game.png" alt="Mystery Doors dApp Join Game" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />

        <p>Confirm the joinGame transaction on MetaMask.</p>
        <img src="./instructions/confirm_joinGame.png" alt="MetaMask Join Game" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <p>If you submit guesses without joining the game, the transaction will revert.</p>
        <p>Select the squares. The hidden squares will always be in a 3-by-3 L-formation in different translations and rotations.</p>
        <img src="./instructions/hidden_doors_orientations.png" alt="MysteryDoors hidden doors orientations" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <p>CLick/press Submit Guesses. The inputs will be encrypted with FHEVM in the browser. It will take 1-2 minutes to encrypt.</p>
        <img src="./instructions/encrypting_inputs.png" alt="MysteryDoors encrypting addGuesses inputs" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
        <p>Once the inputs are encrypted, there will be a contract call to makeGuesses. Confirm this transaction on MetaMask.</p>
        <img src="./instructions/confirm_makeGuesses.png" alt="MetaMask confirm makeGuesses" className="max-w-lg w-xs sm:w-sm md:w-md lg:w-lg" />
      </div>
    </div>
  );
}
