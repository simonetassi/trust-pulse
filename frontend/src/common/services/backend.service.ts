import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Observable } from "rxjs";
import { Device, DeviceHistory, ReputationScore } from "../interfaces";
import { OperatorDevices } from "../interfaces/operator";

@Injectable({ providedIn: 'root'})
export class BackendService {
  private http: HttpClient = inject(HttpClient);
  private readonly base: string = environment.apiUrl;

  public getDevice(deviceId: string): Observable<Device> {
    return this.http.get<Device>(`${this.base}/api/devices/${deviceId}`);
  }

  public getReputation(deviceId: string): Observable<ReputationScore> {
    return this.http.get<ReputationScore>(`${this.base}/api/devices/${deviceId}/reputation`);
  }

  public getHistory(deviceId: string): Observable<DeviceHistory> {
    return this.http.get<DeviceHistory>(`${this.base}/api/devices/${deviceId}/history`);
  }

  public getOperatorDevices(address: string): Observable<OperatorDevices> {
    return this.http.get<OperatorDevices>(`${this.base}/api/operators/${address}/devices`);
  }
}