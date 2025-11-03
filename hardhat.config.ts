import '@typechain/hardhat';
import "@nomicfoundation/hardhat-ethers";
import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import { type HardhatUserConfig } from 'hardhat/config';

import "./tasks/account"
import "./tasks/admin_battleships"
import "./tasks/player_battleships"


const config: HardhatUserConfig = {
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
  },
  solidity: {
    version: '0.8.24',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      viaIR: false,
      evmVersion: 'cancun',
    },
  },
};

export default config;
