import { inject, Injectable } from "@angular/core";
import { WalletService } from "./wallet.service";
import { ethers } from "ethers";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly wallet = inject(WalletService);
  private readonly http = inject(HttpClient);

  private abi: any = null;
  private contractAddress: string | null = null;

  async initialize(): Promise<void> {
    const [artifact, deployments] = await Promise.all([
      firstValueFrom(this.http.get('/assets/ChainReputation.json')),
      firstValueFrom(this.http.get<any>('/assets/deployments.json'))
    ]);

    this.abi = (artifact as any).abi;
    this.contractAddress = deployments['localhost']?.ChainReputation;

    if (!this.contractAddress) {
      throw new Error('Contract address not found in deployments.json');
    }

    console.log('[ContractService] Initialized at', this.contractAddress);
  }


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
    if (!this.abi || !this.contractAddress) {
      throw new Error('ContractService not initialized. Call initialize() first.');
    }
    return new ethers.Contract(
      this.contractAddress,
      this.abi,
      this.wallet.getSigner()
    );
  }
}