import * as chains from "viem/chains";
import { defineChain } from "viem/utils";

export const OPTALYSYS_DEV_CHAIN_ID = 678259798;
export const OPTALYSYS_BLUE_CHAIN_ID = 678259799;


export function getDeploymentHostName(customDomainForProduction: boolean) {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development';
  // console.log('ENV: ', env);
  let deploymentUrl;
  if (env === 'development') {
    deploymentUrl = 'localhost:3000'; // your local hostname and port
    // if using webhooks proxy tunnels:
    // deploymentUrl = process.env.NGROK_URL ?? 'localhost:3000';
  } else if (env === 'production') {
    deploymentUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? '';
  } else {
    deploymentUrl = process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ?? '';
  }
  console.log('ENV: ', { env, deploymentUrl, vercel: process.env.NEXT_PUBLIC_VERCEL_URL });

  if (deploymentUrl === '') {
    throw new Error('Deployment URL couldn\'t be determined');
  }
  return deploymentUrl;
}


export function buildUrlPath(urlBase: string, path: string): string {
  const result = [urlBase, path].map((s) => trimSlash(s)).join('/');

  if (urlBase.startsWith('/')) {
    return `/${result}`;
  } else if (urlBase.startsWith('http')) {
    return result;
  } else {
    return `https://${result}`;
  }
}
function trimSlash(s: string): string {
  // trim leading and trailing slashes
  return s.replace(/^\/+|\/+$/g, '');
}
export const OPTALYSYS_DEV_RPC_URL_PROXY = buildUrlPath(getDeploymentHostName(false), "/rpc");
export const OPTALYSYS_BLUE_RPC_URL_PROXY = buildUrlPath(getDeploymentHostName(false), "/rpc-blue");


export const optalysys_dev_chain = /*#__PURE__*/ defineChain({
  id: OPTALYSYS_DEV_CHAIN_ID,
  name: 'Optalysys dev',
  nativeCurrency: {
    decimals: 18,
    name: 'Optalysys',
    symbol: 'OPT',
  },
  rpcUrls: {
    default: { http: [OPTALYSYS_DEV_RPC_URL_PROXY] },
  },
})
export const optalysys_blue_chain = /*#__PURE__*/ defineChain({
  id: OPTALYSYS_BLUE_CHAIN_ID,
  name: 'Optalysys Blue',
  nativeCurrency: {
    decimals: 18,
    name: 'Optalysys',
    symbol: 'OPT',
  },
  rpcUrls: {
    default: { http: [OPTALYSYS_BLUE_RPC_URL_PROXY] },
  },
})
export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

export type ScaffoldConfig = BaseConfig;

const rawAlchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
if (!rawAlchemyKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Environment variable NEXT_PUBLIC_ALCHEMY_API_KEY is required in production.");
  } else {
    // eslint-disable-next-line no-console
    console.warn("NEXT_PUBLIC_ALCHEMY_API_KEY is not set. Falling back to public RPCs.");
  }
}

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [optalysys_dev_chain, optalysys_blue_chain],
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: 30000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: rawAlchemyKey || "",
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    [OPTALYSYS_DEV_CHAIN_ID]: OPTALYSYS_DEV_RPC_URL_PROXY,
    [OPTALYSYS_BLUE_CHAIN_ID]: OPTALYSYS_BLUE_RPC_URL_PROXY,
    // Example:
    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  onlyLocalBurnerWallet: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
