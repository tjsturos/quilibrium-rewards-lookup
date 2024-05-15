import 'dotenv/config'
import fs from 'fs'
import { Alchemy, Network, Utils } from "alchemy-sdk";

import { SHA3 } from 'sha3';

import bs58 from 'bs58';
import abiJS from './abi.js'

let contractInterface = new Utils.Interface(abiJS);

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

let sha3Prefix;

// if true, this will use a cached allData.json file containing the alchemy data, 
// rather than fetch fresh data
const devMode = true;

const wQuilAddress = "0x8143182a775C54578c8B7b3Ef77982498866945D";

// Fetch data from the URL with pagination
async function fetchData() {
  sha3Prefix = await generateSha3Prefix();
  let allData = [];
  const latestBlock = await alchemy.core.getBlock("latest");
  let latestBlockHeight = null;
  if (latestBlock !== null) {
    latestBlockHeight = latestBlock.number;
  } else {
    throw new Error('No latest block found');
  }

  let startBlock = 19858699; // 0x12F050B
  let endBlock = startBlock + 2000; // 0x12F0CDB
  // Alchemy will return pageKey = undefined when done
  while (startBlock < latestBlockHeight) {
    let data = await alchemy.core.getLogs({
      address: wQuilAddress,
      topics: [
        "0xc4d88b1adde72eb5acf63f3e219ef5b223262233acf507c3b171277c91973c67"
      ],
      fromBlock: Utils.hexlify(startBlock),
      toBlock:  Utils.hexlify(endBlock),
    });

    if (data.length > 0) {
      const mappedData = data.map((log) => {
        const parsedInfo = contractInterface.decodeEventLog("TokensMintedWithSignature", log.data, log.topics);
        console.log(parsedInfo.mintedTo, typeof parsedInfo)
        return {
          data: log.data,
          to: parsedInfo.mintedTo,
          quantity: Utils.formatUnits(parsedInfo.mintRequest.quantity, 8),
          uid: parsedInfo.mintRequest.uid,
        };
      })
      allData.push(...mappedData);
    }
    startBlock = endBlock + 1;
   
    if (startBlock + 2000 > latestBlockHeight) {
      endBlock = latestBlockHeight;
    } else {
      endBlock = startBlock + 2000;
    }
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
    let rewardNodes;
    try {
      rewardNodes = await getRewardsInfo();
    } catch (e) {
      console.log("Error trying to get rewards info", e.message);
    }

    // Extract relevant information and store in a dictionary
    var BreakException = {};
    const addresses = {};
    allData.forEach(entry => {
      const to = entry.to;
      const uid = entry.uid;
      let peerId = null;
      try {
        
        rewardNodes.forEach((node) => {
          const sha3Suffix = generateSha3Suffix(node.peerId);
          const testUid = generateSha3Hash(sha3Prefix, sha3Suffix);
          console.log(`Comparing ${uid} to ${testUid}`);
          if (testUid === uid) {
            peerId = node.peerId;
            console.log('match found', peerId)
            throw BreakException;
          }
        })
      } catch (e) {
        if (e !== BreakException) throw e;
      }

      if (peerId === null) {
        console.log("No peer found");
        throw new Error('No peer found, means hash is incorrect');
      }

      if (!addresses[to]) {
        addresses[to] = { value: entry.quantity, peerId };
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
      .map(([address, info]) => `${address},${info.value},${info.peerId}`)
      .join('\n');

    fs.writeFileSync('output.csv', `Address,Value,PeerId\n${csvContent}`);
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
}

async function generateSha3Prefix() {
  const disqualifiedPage = await fetch("https://quilibrium.com/rewards/disqualified.json");
  const existingPage = await fetch("https://quilibrium.com/rewards/existing.json");
  const rewardsPage = await fetch("https://quilibrium.com/rewards/rewards.json");
  const vouchersPage = await fetch("https://quilibrium.com/rewards/vouchers.json");

  const hash = new SHA3(256);
  hash.update(await disqualifiedPage.json().toString());
  hash.update(await existingPage.json().toString());
  hash.update(await rewardsPage.json().toString());
  hash.update(await vouchersPage.json().toString());

  // const hash = sha3_256(dqPageJson + existingJson + rewardsJson + vouchersJson)
  const staticHash = '7e1b9708c8a4c0ce46a6bc68aec71ad5244f60a6f5090e2b3a91d7c456c2e462'
  const newHash = hash.digest();
  console.log(`generatedHash ${newHash} vs static: ${staticHash}`)
  return newHash;
}

function generateSha3Suffix(peerId) {
  return bs58.decode(peerId);
}

function generateSha3Hash(prefix, suffix) {
  const hash = new SHA3(256);
  hash.update(prefix).update(suffix.toString());
  console.log(`hash generated: ${hash.digest('hex').toString('hex')}`)
  
  return 'Ox' + hash.digest('hex').toString('hex');
}

async function getRewardsInfo() {
  try {
    const rewardsData = await fetch('https://quilibrium.com/rewards/rewards.json');
    const jsonData = await rewardsData.json();
    return jsonData;

  } catch(e) {
    console.error("Error fetching rewards data", e.message);
  }
}

processData();