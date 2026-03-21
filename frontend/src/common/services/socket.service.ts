import { Injectable, OnDestroy } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { environment } from "../../environments/environment";
import { BehaviorSubject, Observable } from "rxjs";
import { AccuracyReportEvent, AvailabilityReportEvent, DeviceDeactivatedEvent } from "../interfaces";

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket;
  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  public constructor() {
    this.socket = io(environment.wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected: ', this.socket.id);
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected: ', reason);
      this.connectedSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection error:', error.message);
      this.connectedSubject.next(false);
    });
  }

  public onAccuracyReport(): Observable<AccuracyReportEvent> {
    return this.fromEvent<AccuracyReportEvent>('accuracy:report');
  }

  public onAvailabilityReport(): Observable<AvailabilityReportEvent> {
    return this.fromEvent<AvailabilityReportEvent>('availability:report');
  }

  public onDeviceDeactivated(): Observable<DeviceDeactivatedEvent> {
    return this.fromEvent<DeviceDeactivatedEvent>('device:deactivated');
  }


  public ngOnDestroy(): void {
    this.disconnect();
  }

  public get isConnected(): boolean {
    return this.socket.connected;
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  private fromEvent<T>(eventName: string): Observable<T> {
    return new Observable<T>(observer => {
      this.socket.on(eventName, (data: T) => observer.next(data));
      return () => {
        this.socket.off(eventName);
      }
    })
  }
}