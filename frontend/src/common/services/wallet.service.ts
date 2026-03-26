import { Injectable, signal } from "@angular/core";
import { ethers } from "ethers"
import { environment } from "../../environments/environment";

export type WalletState = 'disconnected' | 'connecting' | 'connected' | 'wrong-network';

@Injectable({ providedIn: 'root' })
export class WalletService {
  public readonly address = signal<string| null>(null);
  public readonly state = signal<WalletState>('disconnected');
  public readonly chainId = signal<number | null>(null);

  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  public constructor() {
    if (this.isMetamaskAvailable()) {
      this.restoreSession();
      this.listenToMetamaskEvents();
    }
  }

  public isMetamaskAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  public isCorrectNetwork(chainId: number): boolean {
    return Number(chainId) === environment.hardhatChainId;
  }

  public getSigner(): ethers.Signer {
    if (!this.signer) throw new Error('Wallet not connected.');
    return this.signer;
  }

  public getProvider(): ethers.BrowserProvider {
    if (!this.provider) throw new Error('Wallet not connected.');
    return this.provider;
  }

  public async connect(): Promise<void> {
    if(!this.isMetamaskAvailable()) {
      throw new Error('Metamask not installed');
    }

    this.state.set('connecting');

    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);

      await this.provider.send('eth_requestAccounts', []);

      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();

      this.address.set(address);
      this.chainId.set(Number(network.chainId));
      this.state.set(
        this.isCorrectNetwork(Number(network.chainId)) ? 'connected' : 'wrong-network'
      );
    } catch (error) {
      this.state.set('disconnected');
      throw error;
    }
  }

  public disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.address.set(null);
    this.chainId.set(null);
    this.state.set('disconnected');
  }

  private async restoreSession(): Promise<void> {
    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      const accounts: string[] = await this.provider.send('eth_accounts', []);

      if (accounts.length > 0) {
        this.signer = await this.provider.getSigner();
        const network = await this.provider.getNetwork();

        this.address.set(accounts[0]);
        this.chainId.set(Number(network.chainId));
        this.state.set(
          this.isCorrectNetwork(Number(network.chainId))
            ? 'connected'
            : 'wrong-network'
        );
      }
    } catch {
    }
  }

  private listenToMetamaskEvents(): void {
    window.ethereum.on('accountsChanged', async (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.address.set(accounts[0]);

        if (this.provider) {
          this.signer = await this.provider.getSigner();
        }
      }
    });

    // TODO fix - not working atm
    window.ethereum.on('chainChanged', (chainIdHex: string) => {
      console.log('prova')
      const chainId = parseInt(chainIdHex, 16);
      this.chainId.set(chainId);
    })
  }

}