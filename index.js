import fs from 'fs'
import rewards from './rewards-data.js'
import { Alchemy, Network } from "alchemy-sdk";

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

// if true, this will use a cached allData.json file containing the alchemy data, 
// rather than fetch fresh data
const devMode = false;

const wQuilAddress = "0x8143182a775C54578c8B7b3Ef77982498866945D";

// Fetch data from the URL with pagination
async function fetchData() {
  let allData = [];

  let pageKey = null;

  // Alchemy will return pageKey = undefined when done
  while (pageKey !== undefined) {

    let assetConfig = {
      fromBlock: "0x12F050B",
      fromAddress: "0x0000000000000000000000000000000000000000",
      toBlock: "latest",
      contractAddresses: [wQuilAddress],
      excludeZeroValue: true,
      category: ["erc20"],
    }

    if (pageKey !== null) {
      assetConfig = {
        ...assetConfig,
        pageKey,
      }
    }

    const data = await alchemy.core.getAssetTransfers(assetConfig);
    allData.push(...data.transfers);

    pageKey = data.pageKey;
  }

  return allData;
}

async function processData() {
  try {
    let allData = [];
    if (devMode) {
      try {
        // Attempt to read data from file if in devMode
        allData = JSON.parse(fs.readFileSync('allData.json'));
      } catch (error) {
        // If file doesn't exist or cannot be read, fetch data from URL
        console.log('Error reading file:', error);
        allData = await fetchData();

        // Save fetched data to file
        fs.writeFileSync('allData.json', JSON.stringify(allData, null, 2));
      }
    } else {
      // Fetch data from URL
      allData = await fetchData();
    }

    // Extract relevant information and store in a dictionary
    const addresses = {};
    allData.forEach(entry => {
      const to = entry.to;
      const from = entry.from;
      const value = entry.value;

      if (!addresses[to]) {
        addresses[to] = { value, peerIds: [] };
      }
    });

    // Attach peerIds to addresses
    for (const address in addresses) {
      const value = addresses[address].value;
      rewards.forEach(rewardInfo => {
        if (parseFloat(rewardInfo.reward) === value) {
          addresses[address].peerIds.push(rewardInfo.peerId);
        }
      });
    }

    // Write data to CSV
    const csvContent = Object.entries(addresses)
      .map(([address, info]) => `${address},${info.value},${info.peerIds.join(',')}`)
      .join('\n');

    fs.writeFileSync('output.csv', `Address,Value,Possible PeerIds\n${csvContent}`);
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
}

processData();