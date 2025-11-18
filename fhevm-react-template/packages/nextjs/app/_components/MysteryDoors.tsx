"use client";

import { useCallback, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useMysteryDoorsWagmi } from "~~/hooks/mysteryDoors/useMysteryDoorsWagmi";
import { MysteryDoorsGridMeasured } from "~~/app/_components/MysteryDoorsGrid";
import { DoorId, useMysteryDoorsSelection } from "~~/hooks/mysteryDoors/useMysteryDoorsSelection";
import { getOptalysysRpcUrl } from "~~/scaffold.config";
import { AllowedChainIds } from "~~/utils/helper";

/*
 * Main FHECounter React component with 3 buttons
 *  - "Decrypt" button: allows you to decrypt the current FHECounter count handle.
 *  - "Increment" button: allows you to increment the FHECounter count handle using FHE operations.
 *  - "Decrement" button: allows you to decrement the FHECounter count handle using FHE operations.
 */
export const MysteryDoors = () => {
  const { isConnected, chain } = useAccount();
  const { selected, isSelected, toggleDoor, count } = useMysteryDoorsSelection({
    maxSelected: 5,
  });
  const [playerName, setPlayerName] = useState<string>("");
  const chainId = chain?.id;

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  // Create EIP-1193 provider from wagmi for FHEVM
  const provider = useMemo(() => {
    const rpcUrl = getOptalysysRpcUrl(chainId as AllowedChainIds);

    if (typeof window === "undefined") {
      return rpcUrl;
    } if (typeof (window as any).ethereum === "undefined") {
      return rpcUrl;
    }

    // Get the wallet provider from window.ethereum
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true, // use enabled to dynamically create the instance on-demand
  });

  //////////////////////////////////////////////////////////////////////////////
  // useFHECounter is a custom hook containing all the FHECounter logic, including
  // - calling the FHECounter contract
  // - encrypting FHE inputs
  // - decrypting FHE handles
  //////////////////////////////////////////////////////////////////////////////

  const mysteryDoors = useMysteryDoorsWagmi({
    instance: fhevmInstance,
    initialMockChains,
  });
  const handleJoin = () => {
    if (!playerName) return;
    console.log("JOIN CLICKED", playerName);
    void mysteryDoors.callJoinGame(playerName); // if it returns a Promise
  };

  const isOccupied = useCallback((id: DoorId) => {
    if (mysteryDoors.clearOccupiedPositions === undefined) {
      return false;
    }
    return mysteryDoors.clearOccupiedPositions.includes(id)
  }, [mysteryDoors.clearOccupiedPositions]);

  const isPlayerSelected = useCallback((id: DoorId) => {
    if (mysteryDoors.clearGuesses === undefined || mysteryDoors.clearGuesses.length == 0) {
      return isSelected(id); // player selected
    }
    return mysteryDoors.clearGuesses.includes(BigInt(id)) // decrypted guesses from saved
  }, [mysteryDoors.clearGuesses, isSelected]);

  //////////////////////////////////////////////////////////////////////////////
  // UI Stuff:
  // --------
  // A basic page containing
  // - A bunch of debug values allowing you to better visualize the React state
  // - 1x "Decrypt" button (to decrypt the latest FHECounter count handle)
  // - 1x "Increment" button (to increment the FHECounter)
  // - 1x "Decrement" button (to decrement the FHECounter)
  //////////////////////////////////////////////////////////////////////////////

  const buttonClass =
    "inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg " +
    "transition-all duration-200 hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  // Primary (accent) button — #FFD208 with dark text and warm hover #A38025
  const primaryButtonClass =
    buttonClass +
    " bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D]  cursor-pointer";

  // Secondary (neutral dark) button — #2D2D2D with light text and accent focus
  const secondaryButtonClass =
    buttonClass +
    " bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer";

  // Success/confirmed state — deeper gold #A38025 with dark text
  const successButtonClass =
    buttonClass +
    " bg-[#A38025] text-[#2D2D2D] hover:bg-[#8F6E1E] focus-visible:ring-[#2D2D2D]";

  const titleClass = "font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2";
  const sectionClass = "bg-[#f4f4f4] shadow-lg p-6 mb-6 text-gray-900";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white bordershadow-xl p-8 text-center">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 text-amber-400 text-3xl">
                ⚠️
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Wallet not connected</h2>
            <p className="text-gray-700 mb-6">Connect your wallet to use Mystery Doors</p>
            <div className="flex items-center justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-6xl mx-auto text-gray-900 overflow-y-scroll snap-mandatory h-screen">
      {/* Header */}
      <div className="text-center mb-8 text-black p-6 space-y-6">
        <h1 className="text-3xl font-bold mb-2">Mystery Doors</h1>
        <p className="text-gray-600">Interact with the Fully Homomorphic Encryption Mystery Doors contract. Scroll down for debugging information.</p>
      </div>


      {/* Game grid */}
      <MysteryDoorsGridMeasured bgUrl={"/mysterydoors3.png"} onCellClick={(i) => toggleDoor(i)} isSelected={(i) => isPlayerSelected(i)} isDoorOccupied={isOccupied} />


      {/* Action Buttons */}
      <div className="snap-start grid grid-cols-1 md:grid-cols-3 gap-4 text-black p-6 space-y-6">

        <div className="join">
          <div>
            <label className="input input-lg validator join-item">
              <input className="input-lg mr-2" type="text" placeholder="Player name" value={playerName}
                onChange={(e) => setPlayerName(e.target.value)} required />
            </label>
            <div className="validator-hint hidden">Enter your name</div>
          </div>
          <button disabled={!playerName || mysteryDoors.isProcessing} onClick={handleJoin}
            className="btn btn-lg btn-neutral join-item">Join Game</button>
        </div>
        <button
          className={secondaryButtonClass}
          disabled={!mysteryDoors.canUpdate || selected.length !== 5}
          onClick={() => mysteryDoors.callMakeGuesses(selected)}
        >
          {mysteryDoors.canUpdate
            ? "Submit guesses"
            : mysteryDoors.isProcessing
              ? "⏳ Processing..."
              : "❌ Cannot submit guesses"}
        </button>

        <button
          className={secondaryButtonClass}
          disabled={!mysteryDoors.canUpdate}
          onClick={mysteryDoors.refreshGameOver}
        >
          Game ended: {mysteryDoors.isGameEnded ? "Yes" : "No"}
        </button>


        <button
          className={mysteryDoors.isOccupiedPositionsDecrypted ? successButtonClass : primaryButtonClass}
          disabled={!mysteryDoors.isGameEnded || mysteryDoors.isProcessing}
          onClick={mysteryDoors.decryptOccupiedPositionsHandles}
        >
          {mysteryDoors.isOccupiedPositionsDecrypted
            ? `✅ Decrypted length: ${mysteryDoors.clearOccupiedPositions?.length || 0}`
            : mysteryDoors.isDecryptingOccupiedPositions
              ? "⏳ Decrypting..."
              : "🔓 Decrypt hidden positions"}
        </button>

        <button
          className={primaryButtonClass}
          disabled={mysteryDoors.isProcessing}
          onClick={mysteryDoors.refreshGuessesHandle}
        >
          Retrieve your encrypted guesses
        </button>

        <button
          className={mysteryDoors.isGuessesDecrypted ? successButtonClass : primaryButtonClass}
          disabled={!mysteryDoors.canDecryptGuesses}
          onClick={mysteryDoors.decryptGuessesHandles}
        >
          {mysteryDoors.canDecryptGuesses
            ? "🔓 Decrypt Your Guesses"
            : mysteryDoors.isGuessesDecrypted
              ? `✅ Decrypted: ${mysteryDoors.clearGuesses}`
              : mysteryDoors.isDecryptingGuesses
                ? "⏳ Decrypting..."
                : "❌ Nothing to decrypt"}
        </button>

      </div>

      {/* Hidden Doors Handle Display */}
      {mysteryDoors.isGameEnded && <div className={sectionClass}>
        <h3 className={titleClass}>🚪 Hidden doors Handle (only available when the game has ended)</h3>
        <div className="space-y-3 space-x-3">
          {printProperty("Encrypted Handles", mysteryDoors.occupiedPositionsHandles || "No handle available yet")}
          {printProperty("Decrypted Values", mysteryDoors.isOccupiedPositionsDecrypted && mysteryDoors.clearOccupiedPositions !== undefined ? mysteryDoors.clearOccupiedPositions.join(", ") : "Not decrypted yet")}
        </div>
      </div>}

      {/* Your guesses Handle Display */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🚪 Your Guesses Handle</h3>
        <div className="space-y-3 space-x-3">
          {printProperty("Encrypted Handles", mysteryDoors.handle || "No handle available yet")}
          {printProperty("Decrypted Values", mysteryDoors.isGuessesDecrypted && mysteryDoors.clearGuesses !== undefined ? mysteryDoors.clearGuesses.join(", ") : "Not decrypted yet")}
        </div>
      </div>

      {/* Messages */}
      {
        mysteryDoors.message && (
          <div className={sectionClass}>
            <h3 className={titleClass}>💬 Messages</h3>
            <div className="border bg-white border-gray-200 p-4 overflow-x-scroll w-full">
              <p className="text-gray-800">{mysteryDoors.message}</p>
            </div>
          </div>
        )
      }

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={sectionClass}>
          <h3 className={titleClass}>🔧 FHEVM Instance</h3>
          <div className="space-y-3">
            {printProperty("Instance Status", fhevmInstance ? "✅ Connected" : "❌ Disconnected")}
            {printProperty("Status", fhevmStatus)}
            {printProperty("Error", fhevmError ?? "No errors")}
          </div>
        </div>

        <div className={sectionClass}>
          <h3 className={titleClass}>MysteryDoors Status</h3>
          <div className="space-y-3">
            {printProperty("Selected", `${count}/5`)}
            {printProperty("Selections", `${selected.join(", ") || "None"}`)}
            {printProperty("Refreshing", mysteryDoors.isRefreshing)}
            {printProperty("Decrypting guesses", mysteryDoors.isDecryptingGuesses)}
            {printProperty("Processing", mysteryDoors.isProcessing)}
            {printProperty("Can Get Guesses", mysteryDoors.canGetGuesses)}
            {printProperty("Can Decrypt Guesses", mysteryDoors.canDecryptGuesses)}
            {printProperty("Can Modify", mysteryDoors.canUpdate)}
          </div>
        </div>
      </div>
    </div >
  );
};

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
      <span className="text-gray-800 font-medium">{name}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
        {displayValue}
      </span>
    </div>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  return (
    <div className="flex justify-between items-center py-2 px-3  bg-white border border-gray-200 w-full">
      <span className="text-gray-700 font-medium">{name}</span>
      <span
        className={`font-mono text-sm font-semibold px-2 py-1 border ${value
          ? "text-green-800 bg-green-100 border-green-300"
          : "text-red-800 bg-red-100 border-red-300"
          }`}
      >
        {value ? "✓ true" : "✗ false"}
      </span>
    </div>
  );
}
