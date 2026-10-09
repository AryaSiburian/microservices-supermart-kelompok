/* eslint-disable */
import {
  type CallOptions,
  ChannelCredentials,
  Client,
  type ClientOptions,
  type ClientUnaryCall,
  type handleUnaryCall,
  makeGenericClientConstructor,
  Metadata,
  type ServiceError,
  type UntypedServiceImplementation,
} from "@grpc/grpc-js";
import _m0 from "protobufjs/minimal";

export const protobufPackage = "medcore.pharmacy.v1";

export interface CheckDrugRequest {
  drugCode: string;
  quantityNeeded: number;
}

export interface CheckDrugResponse {
  drugCode: string;
  isAvailable: boolean;
  currentStock: number;
  unitPrice: number;
  message: string;
}

export interface StockItem {
  drugCode: string;
  quantity: number;
}

export interface ReserveStockRequest {
  prescriptionId: string;
  appointmentId: string;
  items: StockItem[];
}

export interface ReserveStockResponse {
  reservationSuccess: boolean;
  transactionReference: string;
  errorDetail: string;
}

function createBaseCheckDrugRequest(): CheckDrugRequest {
  return { drugCode: "", quantityNeeded: 0 };
}

export const CheckDrugRequest = {
  encode(message: CheckDrugRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.drugCode !== "") {
      writer.uint32(10).string(message.drugCode);
    }
    if (message.quantityNeeded !== 0) {
      writer.uint32(16).int32(message.quantityNeeded);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckDrugRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckDrugRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.drugCode = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.quantityNeeded = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CheckDrugRequest {
    return {
      drugCode: isSet(object.drugCode) ? globalThis.String(object.drugCode) : "",
      quantityNeeded: isSet(object.quantityNeeded) ? globalThis.Number(object.quantityNeeded) : 0,
    };
  },

  toJSON(message: CheckDrugRequest): unknown {
    const obj: any = {};
    if (message.drugCode !== "") {
      obj.drugCode = message.drugCode;
    }
    if (message.quantityNeeded !== 0) {
      obj.quantityNeeded = Math.round(message.quantityNeeded);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<CheckDrugRequest>, I>>(base?: I): CheckDrugRequest {
    return CheckDrugRequest.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<CheckDrugRequest>, I>>(object: I): CheckDrugRequest {
    const message = createBaseCheckDrugRequest();
    message.drugCode = object.drugCode ?? "";
    message.quantityNeeded = object.quantityNeeded ?? 0;
    return message;
  },
};

function createBaseCheckDrugResponse(): CheckDrugResponse {
  return { drugCode: "", isAvailable: false, currentStock: 0, unitPrice: 0, message: "" };
}

export const CheckDrugResponse = {
  encode(message: CheckDrugResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.drugCode !== "") {
      writer.uint32(10).string(message.drugCode);
    }
    if (message.isAvailable !== false) {
      writer.uint32(16).bool(message.isAvailable);
    }
    if (message.currentStock !== 0) {
      writer.uint32(24).int32(message.currentStock);
    }
    if (message.unitPrice !== 0) {
      writer.uint32(33).double(message.unitPrice);
    }
    if (message.message !== "") {
      writer.uint32(42).string(message.message);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckDrugResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckDrugResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.drugCode = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.isAvailable = reader.bool();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.currentStock = reader.int32();
          continue;
        case 4:
          if (tag !== 33) {
            break;
          }

          message.unitPrice = reader.double();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.message = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CheckDrugResponse {
    return {
      drugCode: isSet(object.drugCode) ? globalThis.String(object.drugCode) : "",
      isAvailable: isSet(object.isAvailable) ? globalThis.Boolean(object.isAvailable) : false,
      currentStock: isSet(object.currentStock) ? globalThis.Number(object.currentStock) : 0,
      unitPrice: isSet(object.unitPrice) ? globalThis.Number(object.unitPrice) : 0,
      message: isSet(object.message) ? globalThis.String(object.message) : "",
    };
  },

  toJSON(message: CheckDrugResponse): unknown {
    const obj: any = {};
    if (message.drugCode !== "") {
      obj.drugCode = message.drugCode;
    }
    if (message.isAvailable !== false) {
      obj.isAvailable = message.isAvailable;
    }
    if (message.currentStock !== 0) {
      obj.currentStock = Math.round(message.currentStock);
    }
    if (message.unitPrice !== 0) {
      obj.unitPrice = message.unitPrice;
    }
    if (message.message !== "") {
      obj.message = message.message;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<CheckDrugResponse>, I>>(base?: I): CheckDrugResponse {
    return CheckDrugResponse.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<CheckDrugResponse>, I>>(object: I): CheckDrugResponse {
    const message = createBaseCheckDrugResponse();
    message.drugCode = object.drugCode ?? "";
    message.isAvailable = object.isAvailable ?? false;
    message.currentStock = object.currentStock ?? 0;
    message.unitPrice = object.unitPrice ?? 0;
    message.message = object.message ?? "";
    return message;
  },
};

function createBaseStockItem(): StockItem {
  return { drugCode: "", quantity: 0 };
}

export const StockItem = {
  encode(message: StockItem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.drugCode !== "") {
      writer.uint32(10).string(message.drugCode);
    }
    if (message.quantity !== 0) {
      writer.uint32(16).int32(message.quantity);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StockItem {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStockItem();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.drugCode = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.quantity = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): StockItem {
    return {
      drugCode: isSet(object.drugCode) ? globalThis.String(object.drugCode) : "",
      quantity: isSet(object.quantity) ? globalThis.Number(object.quantity) : 0,
    };
  },

  toJSON(message: StockItem): unknown {
    const obj: any = {};
    if (message.drugCode !== "") {
      obj.drugCode = message.drugCode;
    }
    if (message.quantity !== 0) {
      obj.quantity = Math.round(message.quantity);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<StockItem>, I>>(base?: I): StockItem {
    return StockItem.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<StockItem>, I>>(object: I): StockItem {
    const message = createBaseStockItem();
    message.drugCode = object.drugCode ?? "";
    message.quantity = object.quantity ?? 0;
    return message;
  },
};

function createBaseReserveStockRequest(): ReserveStockRequest {
  return { prescriptionId: "", appointmentId: "", items: [] };
}

export const ReserveStockRequest = {
  encode(message: ReserveStockRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prescriptionId !== "") {
      writer.uint32(10).string(message.prescriptionId);
    }
    if (message.appointmentId !== "") {
      writer.uint32(18).string(message.appointmentId);
    }
    for (const v of message.items) {
      StockItem.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReserveStockRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReserveStockRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.prescriptionId = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.appointmentId = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.items.push(StockItem.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ReserveStockRequest {
    return {
      prescriptionId: isSet(object.prescriptionId) ? globalThis.String(object.prescriptionId) : "",
      appointmentId: isSet(object.appointmentId) ? globalThis.String(object.appointmentId) : "",
      items: globalThis.Array.isArray(object?.items) ? object.items.map((e: any) => StockItem.fromJSON(e)) : [],
    };
  },

  toJSON(message: ReserveStockRequest): unknown {
    const obj: any = {};
    if (message.prescriptionId !== "") {
      obj.prescriptionId = message.prescriptionId;
    }
    if (message.appointmentId !== "") {
      obj.appointmentId = message.appointmentId;
    }
    if (message.items?.length) {
      obj.items = message.items.map((e) => StockItem.toJSON(e));
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<ReserveStockRequest>, I>>(base?: I): ReserveStockRequest {
    return ReserveStockRequest.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<ReserveStockRequest>, I>>(object: I): ReserveStockRequest {
    const message = createBaseReserveStockRequest();
    message.prescriptionId = object.prescriptionId ?? "";
    message.appointmentId = object.appointmentId ?? "";
    message.items = object.items?.map((e) => StockItem.fromPartial(e)) || [];
    return message;
  },
};

function createBaseReserveStockResponse(): ReserveStockResponse {
  return { reservationSuccess: false, transactionReference: "", errorDetail: "" };
}

export const ReserveStockResponse = {
  encode(message: ReserveStockResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.reservationSuccess !== false) {
      writer.uint32(8).bool(message.reservationSuccess);
    }
    if (message.transactionReference !== "") {
      writer.uint32(18).string(message.transactionReference);
    }
    if (message.errorDetail !== "") {
      writer.uint32(26).string(message.errorDetail);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReserveStockResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReserveStockResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.reservationSuccess = reader.bool();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.transactionReference = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.errorDetail = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ReserveStockResponse {
    return {
      reservationSuccess: isSet(object.reservationSuccess) ? globalThis.Boolean(object.reservationSuccess) : false,
      transactionReference: isSet(object.transactionReference) ? globalThis.String(object.transactionReference) : "",
      errorDetail: isSet(object.errorDetail) ? globalThis.String(object.errorDetail) : "",
    };
  },

  toJSON(message: ReserveStockResponse): unknown {
    const obj: any = {};
    if (message.reservationSuccess !== false) {
      obj.reservationSuccess = message.reservationSuccess;
    }
    if (message.transactionReference !== "") {
      obj.transactionReference = message.transactionReference;
    }
    if (message.errorDetail !== "") {
      obj.errorDetail = message.errorDetail;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<ReserveStockResponse>, I>>(base?: I): ReserveStockResponse {
    return ReserveStockResponse.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<ReserveStockResponse>, I>>(object: I): ReserveStockResponse {
    const message = createBaseReserveStockResponse();
    message.reservationSuccess = object.reservationSuccess ?? false;
    message.transactionReference = object.transactionReference ?? "";
    message.errorDetail = object.errorDetail ?? "";
    return message;
  },
};

export type PharmacyServiceService = typeof PharmacyServiceService;
export const PharmacyServiceService = {
  checkDrugAvailability: {
    path: "/medcore.pharmacy.v1.PharmacyService/CheckDrugAvailability",
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: CheckDrugRequest) => Buffer.from(CheckDrugRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => CheckDrugRequest.decode(value),
    responseSerialize: (value: CheckDrugResponse) => Buffer.from(CheckDrugResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => CheckDrugResponse.decode(value),
  },
  reservePrescriptionStock: {
    path: "/medcore.pharmacy.v1.PharmacyService/ReservePrescriptionStock",
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: ReserveStockRequest) => Buffer.from(ReserveStockRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => ReserveStockRequest.decode(value),
    responseSerialize: (value: ReserveStockResponse) => Buffer.from(ReserveStockResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => ReserveStockResponse.decode(value),
  },
} as const;

export interface PharmacyServiceServer extends UntypedServiceImplementation {
  checkDrugAvailability: handleUnaryCall<CheckDrugRequest, CheckDrugResponse>;
  reservePrescriptionStock: handleUnaryCall<ReserveStockRequest, ReserveStockResponse>;
}

export interface PharmacyServiceClient extends Client {
  checkDrugAvailability(
    request: CheckDrugRequest,
    callback: (error: ServiceError | null, response: CheckDrugResponse) => void,
  ): ClientUnaryCall;
  checkDrugAvailability(
    request: CheckDrugRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: CheckDrugResponse) => void,
  ): ClientUnaryCall;
  checkDrugAvailability(
    request: CheckDrugRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: CheckDrugResponse) => void,
  ): ClientUnaryCall;
  reservePrescriptionStock(
    request: ReserveStockRequest,
    callback: (error: ServiceError | null, response: ReserveStockResponse) => void,
  ): ClientUnaryCall;
  reservePrescriptionStock(
    request: ReserveStockRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: ReserveStockResponse) => void,
  ): ClientUnaryCall;
  reservePrescriptionStock(
    request: ReserveStockRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: ReserveStockResponse) => void,
  ): ClientUnaryCall;
}

export const PharmacyServiceClient = makeGenericClientConstructor(
  PharmacyServiceService,
  "medcore.pharmacy.v1.PharmacyService",
) as unknown as {
  new (address: string, credentials: ChannelCredentials, options?: Partial<ClientOptions>): PharmacyServiceClient;
  service: typeof PharmacyServiceService;
  serviceName: string;
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
