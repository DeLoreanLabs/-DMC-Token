import fetch from 'node-fetch';
import { StreamflowSui, getNumberFromBN } from '@streamflow/stream';
import BN from 'bn.js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
    
const streamflowClient = new StreamflowSui.SuiStreamClient(
  "https://fullnode.mainnet.sui.io"
);

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

// input parameters: treasury address: string, coin type: string
// returns: circulation: BN
async function getCirculation(treasuryAddress, coinType) {
  const response = await fetch(
    `https://api.streamflow.finance/v1/api/chain/6/contracts?address=${treasuryAddress}`,
    {
      headers: {
        'accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contracts = await response.json();

  const suiContracts = contracts.data.filter(contract => contract.token === coinType);

  let totalWithdrawn = new BN(0);
  let totalDeposited = new BN(0);
  for (const contract of suiContracts) {
    try {
      const stream = await streamflowClient.getOne({ id: contract.address });
      totalWithdrawn = totalWithdrawn.add(stream.withdrawnAmount);
      totalDeposited = totalDeposited.add(stream.depositedAmount);
    } catch (error) {
        console.error(`Error fetching stream ${contract.address}:`, error);
    }
  }

  const coinList = await client.getCoins({
    owner: treasuryAddress,
    coinType: coinType,
  });

  if (coinList.data.length == 0) {
      throw new Error("No coins found");
  }

  let totalBalance = new BN(0);
  coinList.data.forEach(coin => {
      totalBalance = totalBalance.add(new BN(coin.balance));
  });

  console.log("Total balance:", totalBalance.toString());

  console.log("Total withdrawn:", totalWithdrawn.toString());
  console.log("Total deposited:", totalDeposited.toString());

  let totalSupply = new BN(12800000000).mul(new BN(10).pow(new BN(9)));

  const circulation = totalSupply.sub(totalBalance).sub(totalDeposited).add(totalWithdrawn);

  return circulation;
}

// treasury address (the one that creates the vesting contracts), dmc coin type
const circulation = await getCirculation("", "0x4c981f3ff786cdb9e514da897ab8a953647dae2ace9679e8358eec1e3e8871ac::dmc::DMC");
console.log(circulation.toString());
