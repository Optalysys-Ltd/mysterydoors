// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import { FHE, CoprocessorConfig, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";

contract Test {

    euint8 public encryptedSimpleValue;
    euint8 public encryptedSum;

    constructor(
        address aclAdd,
        address fhevmExecutorAdd,
        address kmsVerifierAdd,
        address decryptionOracleAdd
    ) {
        FHE.setCoprocessor(CoprocessorConfig({
            ACLAddress: aclAdd,
            CoprocessorAddress: fhevmExecutorAdd,
            DecryptionOracleAddress: decryptionOracleAdd,
            KMSVerifierAddress: kmsVerifierAdd
        }));

    }

    function storeEncryptedSimpleValue(
        externalEuint8 input,
        bytes calldata inputProof
    ) public {
        encryptedSimpleValue = FHE.fromExternal(input, inputProof);
        FHE.allowThis(encryptedSimpleValue);
        FHE.allow(encryptedSimpleValue, msg.sender);
        FHE.makePubliclyDecryptable(encryptedSimpleValue);
    }

    function storeEncryptedSum(
        externalEuint8 input1,
        externalEuint8 input2,
        bytes calldata inputProof
    ) public {
        encryptedSum = FHE.add(FHE.fromExternal(input1, inputProof), FHE.fromExternal(input2, inputProof));
        FHE.allowThis(encryptedSum);
        FHE.allow(encryptedSum, msg.sender);
        FHE.makePubliclyDecryptable(encryptedSum);
    }
}
