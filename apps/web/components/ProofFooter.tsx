const registryAddress = "0x8e77552B64dE07b39fc12dE6f44CdC0bE42F119c";
const receiptHash = "0x64c8b49033d6d04b894f56906e5ccb6beca1cf9cbd06099f45abe18f3e607b26";

export function ProofFooter() {
  return (
    <footer className="proof-footer">
      <div className="proof-footer__title">Proof on BOT Mainnet</div>
      <div className="proof-footer__grid">
        <div><span>Chain ID</span><strong>677</strong></div>
        <div><span>Registry Address</span><code>{registryAddress}</code></div>
        <div><span>Latest Receipt</span><code>{receiptHash}</code></div>
      </div>
      <a href={`https://scan.botchain.ai/tx/${receiptHash}`} target="_blank" rel="noreferrer">
        View transaction on BOTScan ↗
      </a>
    </footer>
  );
}
