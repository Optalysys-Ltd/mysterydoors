// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, CoprocessorConfig, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";

contract MysteryDoors is Ownable2Step {
    uint8 public MAX_GUESSES = 5;
    uint8 public MAX_PLAYERS = 20;
    uint public numPlayers;
    mapping(address => string) public playerNames;
    address[] public playersList;
    euint8[] public ePlayerCorrectGuessesList;
    /// @notice Constant for zero using TFHE.
    /// @dev    Since it is expensive to compute 0, it is stored instead.
    euint8 private immutable _EUINT8_ZERO;
    euint8 private immutable _EUINT8_ONE;
    bool public gameStarted;
    bool public gameOver;
    euint8[] private occupiedPositions;
    mapping(address => euint8[]) private playerGuesses;
    mapping(address => euint8) private playerCorrectGuesses;

    constructor(
        address aclAdd,
        address fhevmExecutorAdd,
        address kmsVerifierAdd,
        address decryptionOracleAdd
    ) Ownable(msg.sender) {
        FHE.setCoprocessor(
            CoprocessorConfig({
                ACLAddress: aclAdd,
                CoprocessorAddress: fhevmExecutorAdd,
                DecryptionOracleAddress: decryptionOracleAdd,
                KMSVerifierAddress: kmsVerifierAdd
            })
        );
        _EUINT8_ZERO = FHE.asEuint8(0);
        FHE.allowThis(_EUINT8_ZERO);
        _EUINT8_ONE = FHE.asEuint8(1);
        FHE.allowThis(_EUINT8_ONE);
    }

    function collateLeaderboard() public onlyOwner {
        ePlayerCorrectGuessesList = new euint8[](playersList.length);
        for (uint256 i = 0; i < playersList.length; i++) {
            ePlayerCorrectGuessesList[i] = playerCorrectGuesses[playersList[i]];
            FHE.allowThis(ePlayerCorrectGuessesList[i]);
            FHE.allow(ePlayerCorrectGuessesList[i], msg.sender);
        }
    }

    function getPlayersCorrectGuesses()
        public
        view
        returns (address[] memory, euint8[] memory)
    {
        return (playersList, ePlayerCorrectGuessesList);
    }

    function endGame() external onlyOwner {
        require(gameStarted, "The game has not yet started.");
        gameOver = true;
        collateLeaderboard();
        for (uint256 i = 0; i < occupiedPositions.length; i++) {
            FHE.makePubliclyDecryptable(occupiedPositions[i]);
        }
    }

    function startGame() public onlyOwner {
        require(!gameStarted, "The game has already started.");
        gameStarted = true;
        gameOver = false;
    }

    function joinGame(string calldata name) public {
        require(
            numPlayers < MAX_PLAYERS,
            "The game is full. Please try again later."
        );
        playerNames[msg.sender] = name;
        playersList.push(msg.sender);
        numPlayers++;
    }

    function markOccupied(
        externalEuint8 exPos1,
        externalEuint8 exPos2,
        externalEuint8 exPos3,
        externalEuint8 exPos4,
        externalEuint8 exPos5,
        bytes calldata inputProof
    ) public onlyOwner {
        require(
            !gameStarted,
            "Ships can only be placed before the game starts"
        );
        euint8 ePos1 = FHE.fromExternal(exPos1, inputProof);
        FHE.allowThis(ePos1);
        occupiedPositions.push(ePos1);

        euint8 ePos2 = FHE.fromExternal(exPos2, inputProof);
        FHE.allowThis(ePos2);
        occupiedPositions.push(ePos2);

        euint8 ePos3 = FHE.fromExternal(exPos3, inputProof);
        FHE.allowThis(ePos3);
        occupiedPositions.push(ePos3);

        euint8 ePos4 = FHE.fromExternal(exPos4, inputProof);
        FHE.allowThis(ePos4);
        occupiedPositions.push(ePos4);

        euint8 ePos5 = FHE.fromExternal(exPos5, inputProof);
        FHE.allowThis(ePos5);
        occupiedPositions.push(ePos5);
    }

    function makeGuesses(
        externalEuint8 exPos1,
        externalEuint8 exPos2,
        externalEuint8 exPos3,
        externalEuint8 exPos4,
        externalEuint8 exPos5,
        bytes calldata inputProof
    ) public {
        require(gameStarted, "The game has not started yet.");
        require(!gameOver, "The game is over.");
        require(
            bytes(playerNames[msg.sender]).length > 0,
            "You have not joined the game!"
        );

        euint8[] memory eGuesses = new euint8[](MAX_GUESSES);

        euint8 ePos1 = FHE.fromExternal(exPos1, inputProof);
        FHE.allowThis(ePos1);
        FHE.allow(ePos1, msg.sender);
        eGuesses[0] = ePos1;

        euint8 ePos2 = FHE.fromExternal(exPos2, inputProof);
        FHE.allowThis(ePos2);
        FHE.allow(ePos2, msg.sender);
        eGuesses[1] = ePos2;

        euint8 ePos3 = FHE.fromExternal(exPos3, inputProof);
        FHE.allowThis(ePos3);
        FHE.allow(ePos3, msg.sender);
        eGuesses[2] = ePos3;

        euint8 ePos4 = FHE.fromExternal(exPos4, inputProof);
        FHE.allowThis(ePos4);
        FHE.allow(ePos4, msg.sender);
        eGuesses[3] = ePos4;

        euint8 ePos5 = FHE.fromExternal(exPos5, inputProof);
        FHE.allowThis(ePos5);
        FHE.allow(ePos5, msg.sender);
        eGuesses[4] = ePos5;

        for (uint256 g = 0; g < eGuesses.length; g++) {
            euint8 eGuess = eGuesses[g];
            for (uint256 i = 0; i < occupiedPositions.length; i++) {
                euint8 occupiedPosition = occupiedPositions[i];
                ebool correctlyGuessed = FHE.eq(eGuess, occupiedPosition);
                playerCorrectGuesses[msg.sender] = FHE.add(
                    playerCorrectGuesses[msg.sender],
                    FHE.select(correctlyGuessed, _EUINT8_ONE, _EUINT8_ZERO)
                );
                FHE.allowThis(playerCorrectGuesses[msg.sender]);
                FHE.allow(playerCorrectGuesses[msg.sender], msg.sender);
            }
        }
    }

    function getGuesses() public view returns (euint8[] memory) {
        return playerGuesses[msg.sender];
    }

    function getCorrectGuesses() public view returns (euint8) {
        return playerCorrectGuesses[msg.sender];
    }

    function getOccupiedPositions() public view returns (euint8[] memory) {
        require(gameOver, "The game has not ended yet.");
        return occupiedPositions;
    }
}
