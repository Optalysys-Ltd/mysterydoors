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
        <div>JSON RPC URL: <pre>https://rpc.gcp-testnet-eth.dev.optalysys.com</pre></div>
        <div>Chain ID: <pre>678259798</pre></div>

        <h4>Blue (FPGA-accelerated) testnet</h4>
        <div>JSON RPC URL: <pre>https://rpc.gcp-testnet-eth.blue.optalysys.com/</pre></div>
        <div>Chain ID: <pre>678259799</pre></div>

        <img src="./instructions/metamask_add_network.png" alt="Add network to Metamask" className="max-w-lg" />

        <h3>Add account by importing the private key</h3>
        <p>Choose Add Account and import the Optalysys private key by scanning the QR code or typing it in.</p>
        <img src="./instructions/metamask_add_account.png" alt="Add account to Metamask" className="max-w-lg" />
        <img src="./instructions/metamask_import_account.png" alt="Import account to Metamask" className="max-w-lg" />
        <img src="./instructions/metamask_import_private_key.png" alt="Import private key to Metamask" className="max-w-lg" />

        <h2>Go to the Mystery Doors dApp</h2>
        <p>Open the link below to access the Mystery Doors dApp</p>
        <p><Link href="/mysterydoors"><button className="btn btn-lg btn-primary">MysteryDoors</button></Link></p>
        <p>Switch wallets to the newly-imported wallet. Connect your wallet to the Mystery Doors dApp</p>
        <img src="./instructions/metamask_connect_account.png" alt="Metamask connect account to Mystery Doors dApp" className="max-w-lg" />

      </div>
    </div>
  );
}
