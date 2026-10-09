/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "medcore.clinical.v1";

/** Modul tidak memberikan definisi RPC clinical; ini kontrak logical ID. */
export interface PatientReference {
  patientId: string;
}

export interface AppointmentReference {
  appointmentId: string;
  patientId: string;
}

function createBasePatientReference(): PatientReference {
  return { patientId: "" };
}

export const PatientReference = {
  encode(message: PatientReference, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.patientId !== "") {
      writer.uint32(10).string(message.patientId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PatientReference {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePatientReference();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.patientId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PatientReference {
    return { patientId: isSet(object.patientId) ? globalThis.String(object.patientId) : "" };
  },

  toJSON(message: PatientReference): unknown {
    const obj: any = {};
    if (message.patientId !== "") {
      obj.patientId = message.patientId;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PatientReference>, I>>(base?: I): PatientReference {
    return PatientReference.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PatientReference>, I>>(object: I): PatientReference {
    const message = createBasePatientReference();
    message.patientId = object.patientId ?? "";
    return message;
  },
};

function createBaseAppointmentReference(): AppointmentReference {
  return { appointmentId: "", patientId: "" };
}

export const AppointmentReference = {
  encode(message: AppointmentReference, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.appointmentId !== "") {
      writer.uint32(10).string(message.appointmentId);
    }
    if (message.patientId !== "") {
      writer.uint32(18).string(message.patientId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppointmentReference {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppointmentReference();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.appointmentId = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.patientId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): AppointmentReference {
    return {
      appointmentId: isSet(object.appointmentId) ? globalThis.String(object.appointmentId) : "",
      patientId: isSet(object.patientId) ? globalThis.String(object.patientId) : "",
    };
  },

  toJSON(message: AppointmentReference): unknown {
    const obj: any = {};
    if (message.appointmentId !== "") {
      obj.appointmentId = message.appointmentId;
    }
    if (message.patientId !== "") {
      obj.patientId = message.patientId;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<AppointmentReference>, I>>(base?: I): AppointmentReference {
    return AppointmentReference.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<AppointmentReference>, I>>(object: I): AppointmentReference {
    const message = createBaseAppointmentReference();
    message.appointmentId = object.appointmentId ?? "";
    message.patientId = object.patientId ?? "";
    return message;
  },
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
