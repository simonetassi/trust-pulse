import { inject, Injectable } from "@angular/core";

import ChainReputationAbi from '../../../../blockchain/artifacts/contracts/ChainReputation.sol/ChainReputation.json';
import deployments from '../../../../deployments.json';
import { WalletService } from "./wallet.service";
import { ethers } from "ethers";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly wallet = inject(WalletService);

  public async getOperator(address: string): Promise<{
    name: string;
    registered: boolean;
    registeredAt: number;
  }> {
    const contract = this.getContract();
    const op = await contract['operators'](address);
    return {
      name: op.name,
      registered: op.registered,
      registeredAt: Number(op.registeredAt)
    };
  }

  public async registerOperator(name: string): Promise<ethers.TransactionReceipt> {
    const contract = this.getContract();
    const tx = await contract['registerOperator'](name);
    return await tx.wait();
  } 

  public async enrollDevice(wotEndpoint: string, deviceType: string): Promise<ethers.TransactionReceipt> {
    const contract = this.getContract();
    const tx = await contract['enrollDevice'](wotEndpoint, deviceType);
    return await tx.wait();
  }

  public async deactivateDevice(deviceId: string): Promise<ethers.TransactionReceipt> {
    const contract = this.getContract();
    const tx = await contract['deactivateDevice'](deviceId);
    return await tx.wait();
  }
  
  private getContract(): ethers.Contract {
    const signer = this.wallet.getSigner();
    const address = (deployments as any)[environment.network]?.ChainReputation;

    if (!address) {
      throw new Error(`No deployment found for network: ${environment.network}`);
    }

    return new ethers.Contract(address, ChainReputationAbi.abi, signer);
  }
}