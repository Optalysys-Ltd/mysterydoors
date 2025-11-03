// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, CoprocessorConfig, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";

contract Battleships is Ownable2Step {
    struct Coord {
        uint8 x;
        uint8 y;
    }

    struct ECoord {
        euint8 x;
        euint8 y;
    }
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
    ECoord[] private shipPositions;
    mapping(address => ECoord[]) private playerGuesses;
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

    function endGame() external onlyOwner {
        gameOver = true;
        address[] memory players = playersList;
        ePlayerCorrectGuessesList = new euint8[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            ePlayerCorrectGuessesList[i] = playerCorrectGuesses[players[i]];
            FHE.allowThis(ePlayerCorrectGuessesList[i]);
            FHE.allow(ePlayerCorrectGuessesList[i], msg.sender);
        }
        for (uint256 i = 0; i < shipPositions.length; i++) {
            euint8 x = shipPositions[i].x;
            euint8 y = shipPositions[i].y;
            FHE.makePubliclyDecryptable(x);
            FHE.makePubliclyDecryptable(y);
        }
    }

    function getPlayersCorrectGuesses() public view returns (address[] memory, euint8[] memory) {
        return (playersList, ePlayerCorrectGuessesList);
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

    function placeShip(
        externalEuint8 eX,
        externalEuint8 eY,
        bytes calldata inputProof
    ) public onlyOwner {
        require(
            !gameStarted,
            "Ships can only be placed before the game starts"
        );
        euint8 x = FHE.fromExternal(eX, inputProof);
        FHE.allowThis(x);

        euint8 y = FHE.fromExternal(eY, inputProof);
        FHE.allowThis(y);
        shipPositions.push(ECoord({x: x, y: y}));
    }

    function addGuess(
        externalEuint8 eX,
        externalEuint8 eY,
        bytes calldata inputProof
    ) public {
        require(gameStarted, "The game has not started yet.");
        require(!gameOver, "The game is over.");
        require(
            bytes(playerNames[msg.sender]).length > 0,
            "You have not joined the game!"
        );
        ECoord[] storage existingPlayerGuesses = playerGuesses[msg.sender];
        uint256 numGuesses = existingPlayerGuesses.length;
        require(numGuesses < MAX_GUESSES, "You are out of guesses!");

        euint8 x = FHE.fromExternal(eX, inputProof);
        FHE.allowThis(x);
        FHE.allow(x, msg.sender);

        euint8 y = FHE.fromExternal(eY, inputProof);
        FHE.allowThis(y);
        FHE.allow(y, msg.sender);
        existingPlayerGuesses.push(ECoord({x: x, y: y}));

        for (uint256 i = 0; i < shipPositions.length; i++) {
            ECoord storage shipPosition = shipPositions[i];
            ebool xMatches = FHE.eq(x, shipPosition.x);
            ebool yMatches = FHE.eq(y, shipPosition.y);
            playerCorrectGuesses[msg.sender] = FHE.add(
                playerCorrectGuesses[msg.sender],
                FHE.select(
                    FHE.and(xMatches, yMatches),
                    _EUINT8_ONE,
                    _EUINT8_ZERO
                )
            );
            FHE.allowThis(playerCorrectGuesses[msg.sender]);
            FHE.allow(playerCorrectGuesses[msg.sender], msg.sender);
        }
    }

    function getGuesses() public view returns (ECoord[] memory) {
        return playerGuesses[msg.sender];
    }

    function getCorrectGuesses() public view returns (euint8) {
        return playerCorrectGuesses[msg.sender];
    }

    function getShipPositions() public view returns (ECoord[] memory) {
        require(gameOver, "The game has not ended yet.");
        return shipPositions;
    }

}
