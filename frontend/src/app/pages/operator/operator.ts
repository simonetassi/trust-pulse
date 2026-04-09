import { Component, effect, inject } from '@angular/core';
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
      console.error("RAW WALLET ERROR:", error);
      this.registerState = 'error';
      this.registerError = this.parseError(error);
    }
  }

  async enrollDevice(): Promise<void> {
    this.enrollState = 'loading';
    this.enrollError = null;
    this.enrolledDeviceId = null;

    try {
      const validation = await this.validateThingDescription(this.deviceEndpoint);
      
      if (!validation.valid) {
        this.enrollState = 'error';
        this.enrollError = validation.reason || 'Invalid Thing Description.';
        return; 
      }

      await this.contract.enrollDevice(this.deviceEndpoint, this.deviceType);

      const { ethers } = await import('ethers');
      this.enrolledDeviceId = ethers.keccak256(
        ethers.toUtf8Bytes(this.deviceEndpoint)
      );

      this.enrollState = 'success';
      this.deviceEndpoint = '';
      this.deviceType = '';
    } catch (error: any) {
      console.error("RAW WALLET ERROR:", error);
      this.enrollState = 'error';
      this.enrollError = this.parseError(error);
    }
  }

  private async validateThingDescription(endpoint: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) return { valid: false, reason: `HTTP Status: ${response.status}` };

      const td = await response.json();
      if (!td || typeof td !== 'object' || !td.properties) {
        return { valid: false, reason: "Invalid TD: Missing 'properties' schema." };
      }

      const hbSchema = td.properties['heartbeatInterval'];
      if (!hbSchema) {
        return { valid: false, reason: "Invalid TD: Missing required 'heartbeatInterval' property." };
      }
      if (hbSchema.type !== 'number' && hbSchema.type !== 'integer') {
        return { valid: false, reason: "Invalid TD: 'heartbeatInterval' must be a numeric type." };
      }

      for (const [propName, propSchema] of Object.entries<any>(td.properties)) {
        if (propSchema.type === 'number' || propSchema.type === 'integer') {
          if (propName !== 'heartbeatInterval') {
            if (propSchema.minimum === undefined || propSchema.maximum === undefined) {
              return { valid: false, reason: `Invalid Schema: Numeric property '${propName}' is missing min/max bounds.` };
            }
            if (propSchema.minimum >= propSchema.maximum) {
              return { valid: false, reason: `Invalid Schema: '${propName}' min >= max.` };
            }
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: "Network error or invalid JSON." };
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