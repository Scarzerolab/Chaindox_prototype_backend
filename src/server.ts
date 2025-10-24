import express from "express";
import dotenv from 'dotenv';
import { ethers } from "ethers";
import { authMiddleware } from "./middleware.js";
import { DocumentStoreFactory } from "@tradetrust-tt/document-store";
import { v5Contracts, v5ContractAddress, v5Utils } from "@trustvc/trustvc";
// import trustvcPkg from "@trustvc/trustvc";

// const { v5Contracts, v5ContractAddress, v5Utils } = trustvcPkg;

dotenv.config();

const app = express();
app.use(express.json());

app.use(authMiddleware);

const getWallet = () => {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    return new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
}

app.post('/deploy-document-store', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' })
        }

        const wallet = getWallet();
        const factory = new DocumentStoreFactory(wallet);
        const documentStore = await factory.deploy(name, wallet.address);
        const address = await documentStore.getAddress();
        const tx = documentStore.deploymentTransaction();
        const receipt = await tx?.wait();

        res.json({
            address,
            transactionHash: receipt?.hash,
            name,
            owner: wallet.address
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/deploy-token-registry', async (req, res) => {
    try {
        const { name, symbol } = req.body;

        if (!name || !symbol) {
            return res.status(400).json({ error: 'name and symbol are required' });
        }

        // const {v5Contracts, v5ContractAddress, v5Utils} = await import("@trustvc/trustvc");

        const wallet = getWallet();
        const walletAddress = await wallet.getAddress();
        const chainId = (await wallet.provider?.getNetwork())?.chainId;

        const { TDocDeployer__factory } = v5Contracts;
        const { TokenImplementation, Deployer } = v5ContractAddress;
        const { encodeInitParams, getEventFromReceipt } = v5Utils;

        const deployerContract = TDocDeployer__factory.connect(
            Deployer[Number(chainId)],
            wallet
        );

        // const deployerContract = new ethers.Contract(
        //     Deployer[Number(chainId)],
        //     TDocDeployer__factory.abi,
        //     wallet
        // )

        const initparam = encodeInitParams({
            name,
            symbol,
            deployer: walletAddress,
        })

        const tx = await deployerContract.deploy(
            TokenImplementation[Number(chainId)],
            initparam
        );
        const receipt = await tx.wait();

        const registryAddress = getEventFromReceipt<any>(
            receipt,
            (deployerContract as any).getEventTopic("Deployment"),
            deployerContract.interface
        ).args.deployed;

        // const registryAddress = v5Utils.getEventFromReceipt<any>(
        //     receipt,
        //     "deployment",
        //     deployerContract.interface
        // ).args.deployed;

        res.json({
            address: registryAddress,
            transactionHash: receipt?.hash,
            name,
            symbol,
            owner: walletAddress
        })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`)
})