export default function BucketSelector({ currentBucket }) {
  return (
    <select
      name="bucket"
      defaultValue={currentBucket}
      className="text-sm px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
    >
      <option value="tradion">Tradion</option>
      <option value="staubfilter">Staubfilter</option>
      <option value="rest">Rest</option>
    </select>
  );
}
