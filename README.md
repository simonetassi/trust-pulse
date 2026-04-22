# Trust-Pulse: A Trustless Reputation Framework for Web of Things

Trust-Pulse is a decentralized reputation system engineered for Web of Things (WoT) devices. It utilizes Ethereum smart contracts and a quorum-based decentralized oracle network (DON) to independently observe, evaluate, and immutably record device behavior across two orthogonal dimensions: accuracy and availability.

The repository encompasses the complete end-to-end architecture, comprising the Solidity smart contracts, the Node.js oracle network, the WoT simulation environment, the backend API, and the Angular frontend.

## Prerequisites

The following dependencies are required to build and execute the system:
* Docker and Docker Compose
* Node.js (v18 or higher)
* MetaMask (Browser Extension) configured for Localhost 8545 and/or the Sepolia Testnet

## Environment Configuration

Environment variables must be configured prior to system initialization.

1. Duplicate the provided `.env.example` template to establish a new `.env` file at the repository root:
```bash
cp .env.example .env
```

2. Populate the `.env` file with the required cryptographic keys and RPC endpoints.
* **Local Hardhat:** Three private keys derived from standard Hardhat test accounts are required to provision the oracle instances.
* **Sepolia Testnet:** An external RPC provider URL (e.g., Alchemy or Infura), a deployer wallet private key, and three distinct wallet private keys and addresses for the authorized oracles are required.

## Local Deployment (Hardhat)

The local development environment operates within a fully containerized architecture. Upon initiation, a local Hardhat node is provisioned, smart contracts are deployed, and network addresses are propagated via shared Docker volumes.

1. Build and initiate the local environment:
```bash
docker-compose up --build
```

2. The orchestration engine executes the following automated sequence:
   * Provisions a local Hardhat node (`blockchain`).
   * Executes the local deployment and setup scripts (`contract-setup`).
   * Initializes the WoT device simulation network (`wot-network`).
   * Deploys the backend event relay and REST API (`api`).
   * Provisions three independent oracle instances (`oracle-1`, `oracle-2`, `oracle-3`).
   * Serves the Angular frontend application (`frontend`).

3. MetaMask Configuration:
   * Network: `Localhost 8545`
   * Chain ID: `31337`
   * Import a designated Hardhat test account to operate as the Device Operator.

## Public Testnet Deployment (Sepolia)

For deployments targeting public testnets such as Sepolia, smart contracts require manual deployment from the host system prior to container initialization. The Sepolia orchestration expects deployment artifacts to reside on the host system.

1. Navigate to the blockchain directory and install dependencies:
```bash
cd blockchain
npm install
```

2. Compile the smart contracts to generate the necessary artifacts:
```bash
npx hardhat compile
```

3. Deploy the smart contracts to the Sepolia network and configure the oracles. Ensure the `.env` file is fully populated with Sepolia credentials before executing the following commands:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/setup.ts --network sepolia
```

4. Return to the repository root and start the Sepolia Docker orchestration:
```bash
cd ..
docker-compose -f docker-compose.sepolia.yaml up --build
```

5. MetaMask Configuration:
   * Network: `Sepolia Testnet`
   * It is required that the connected wallet holds sufficient Sepolia ETH to execute registration and device enrollment transactions.

## Frontend Dashboard

Upon successful initialization, the Dashboard service is exposed on http://localhost:4200.

## System Termination and Teardown

To terminate the services and gracefully shut down the containers, issue `Ctrl+C` within the active terminal, or execute the following command in a separate terminal:

```bash
docker-compose down
```
For Sepolia deployments:
```bash
docker-compose -f docker-compose.sepolia.yaml down
```