# Lookup Quilibrium Rewards
The goal is to create a CSV of wallets that claimed tokens and their potential Quilibrium peerIds.

## To Run
### API Key Requirements
To run, this requires [an Alchemy key](https://dashboard.alchemy.com/) for Ethereum.

#### Add API Key(s) to .env file
Copy the .env.example to a new .env file.
Paste your Alchemy API key for Ethereum to ALCHEMY_API_KEY="your-key-here"

### Installing Node Modules
```
yarn
yarn start
```

### Output
Will create a output.csv when done.
#### Notes on Output
There are many that have the same reward amounts, so you will often see a wallet address with many possible peerIds.