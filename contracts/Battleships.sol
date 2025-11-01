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
    /// @notice Constant for zero using TFHE.
    /// @dev    Since it is expensive to compute 0, it is stored instead.
    euint8 private immutable _EUINT8_ZERO;
    euint8 private immutable _EUINT8_ONE;
    bool public gameStarted;
    bool public gameOver;
    Coord[] private shipPositions; // TODO: encrypt shipPositions
    mapping(address => ECoord[]) private playerGuesses;
    mapping(address => euint8) private playerCorrectGuesses;
    mapping(address => uint8) private decryptedPlayerCorrectGuesses;

    constructor(
        address aclAdd,
        address fhevmExecutorAdd,
        address kmsVerifierAdd,
        address decryptionOracleAdd,
        Coord[] memory initShipPositions
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
        for (uint256 i = 0; i < initShipPositions.length; i++) {
            shipPositions.push(initShipPositions[i]);
        }
    }

    function endGame() public onlyOwner {
        gameOver = true;
    }

    function startGame() public onlyOwner {
        gameStarted = true;
        gameOver = false;
    }

    function addGuess(
        externalEuint8 eX,
        externalEuint8 eY,
        bytes calldata inputProof
    ) public {
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
            Coord storage shipPosition = shipPositions[i];
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

    
}
