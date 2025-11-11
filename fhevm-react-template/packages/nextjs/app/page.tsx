import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <Link href="/counter"><button className="btn">Counter</button></Link><br />
        <Link href="/mysterydoors"><button className="btn">MysteryDoors</button></Link><br />

      </div>
    </div>
  );
}
