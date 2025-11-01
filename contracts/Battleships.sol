// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, CoprocessorConfig, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";

contract Battleships is Ownable2Step {
    struct Coord {
        uint8 x;
        uint8 y;
    }

    struct ECoord {
        euint8 x;
        euint8 y;
    }

    bool public gameOver;
    Coord[] private shipPositions;
    mapping(address => ECoord[]) private playerGuesses;

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
        for (uint256 i = 0; i < initShipPositions.length; i++) {
            shipPositions.push(initShipPositions[i]);
        }
    }

    function endGame() public onlyOwner {
        gameOver = true;
    }
}
