export type Cluster = "devnet" | "mainnet-beta" | "localnet";

function clusterQuery(cluster: Cluster): string {
  if (cluster === "mainnet-beta") return "";
  if (cluster === "localnet") return "?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899";
  return `?cluster=${cluster}`;
}

export function txLink(sig: string, cluster: Cluster): string {
  return `https://explorer.solana.com/tx/${sig}${clusterQuery(cluster)}`;
}

export function accountLink(pubkey: string, cluster: Cluster): string {
  return `https://explorer.solana.com/address/${pubkey}${clusterQuery(cluster)}`;
}
