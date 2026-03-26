import { Component, OnInit, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../common/services/wallet.service';
import { ContractService } from '../../../common/services/contract.service';

type PageState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './operator.html',
  styleUrl: './operator.scss',
})
export class OperatorComponent {
  public readonly wallet = inject(WalletService);
  private readonly contract = inject(ContractService);

  protected readonly environment = { hardhatChainId: 31337 };

  public walletError: string | null = null;

  public operatorName = '';
  public isRegistered = false;
  public registeredName = '';
  public registerState: PageState = 'idle';
  public registerError: string | null = null;

  public deviceEndpoint = '';
  public deviceType = '';
  public enrollState: PageState = 'idle';
  public enrollError: string | null = null;
  public enrolledDeviceId: string | null = null;

  public constructor() {
    effect(() => {
      const currentAddress = this.wallet.address();
      const currentState = this.wallet.state();
  
      if (currentState === 'connected' && currentAddress) {
        this.isRegistered = false; 
        this.registeredName = '';
        
        this.checkRegistration();
      } else {
        this.isRegistered = false;
        this.registeredName = '';
      }
    });
  }

  async connectWallet(): Promise<void> {
    this.walletError = null;
    try {
      await this.wallet.connect();
    } catch (error: any) {
      this.walletError = this.parseError(error);
    }
  }

  async registerOperator(): Promise<void> {
    this.registerState = 'loading';
    this.registerError = null;

    try {
      await this.contract.registerOperator(this.operatorName);
      this.isRegistered = true;
      this.registeredName = this.operatorName;
      this.registerState = 'success';
    } catch (error: any) {
      this.registerState = 'error';
      this.registerError = this.parseError(error);
    }
  }

  async enrollDevice(): Promise<void> {
    this.enrollState = 'loading';
    this.enrollError = null;
    this.enrolledDeviceId = null;

    try {
      await this.contract.enrollDevice(this.deviceEndpoint, this.deviceType);

      const { ethers } = await import('ethers');
      this.enrolledDeviceId = ethers.keccak256(
        ethers.toUtf8Bytes(this.deviceEndpoint)
      );

      this.enrollState = 'success';
      this.deviceEndpoint = '';
      this.deviceType = '';
    } catch (error: any) {
      this.enrollState = 'error';
      this.enrollError = this.parseError(error);
    }
  }

  private async checkRegistration(): Promise<void> {
    const address = this.wallet.address();
    if (!address) return;

    try {
      const op = await this.contract.getOperator(address);
      this.isRegistered = op.registered;
      this.registeredName = op.name;
    } catch {
      this.isRegistered = false;
    }
  }

  private parseError(error: any): string {
    if (error?.reason) return error.reason;
    if (error?.message?.includes('Already registered')) return 'Already registered.';
    if (error?.message?.includes('Device already enrolled')) return 'Device already enrolled.';
    if (error?.message?.includes('user rejected')) return 'Transaction rejected in MetaMask.';
    return 'Operation failed. Check the console for details.';
  }
}