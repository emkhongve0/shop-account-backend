declare module "vietqr" {
  export class VietQR {
    constructor(config?: { clientID?: string; apiKey?: string });
    genQRText(options: {
      bank: string;
      accountNo: string;
      accountName: string;
      amount?: number | string;
      memo?: string;
    }): string;
  }
}
