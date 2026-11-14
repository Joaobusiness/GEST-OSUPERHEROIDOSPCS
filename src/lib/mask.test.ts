import { describe, expect, it } from "vitest";
import { maskCep, maskDocument, maskPhone } from "./mask";

describe("masks", () => {
  it("phone, step by step and pasted", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("6")).toBe("(6");
    expect(maskPhone("65")).toBe("(65");
    expect(maskPhone("659")).toBe("(65) 9");
    expect(maskPhone("65999")).toBe("(65) 999");
    expect(maskPhone("6599998")).toBe("(65) 9999-8"); // 7 digits: landline pattern until the 11th digit
    expect(maskPhone("65999998888")).toBe("(65) 99999-8888");
    expect(maskPhone("+55 (65) 99999-8888")).toBe("(65) 99999-8888");
    expect(maskPhone("5599998888")).toBe("(55) 9999-8888"); // DDD 55 is not stripped
    expect(maskPhone("659999988889999")).toBe("(65) 99999-8888");
  });
  it("cpf and cnpj", () => {
    expect(maskDocument("123")).toBe("123");
    expect(maskDocument("1234")).toBe("123.4");
    expect(maskDocument("1234567")).toBe("123.456.7");
    expect(maskDocument("12345678909")).toBe("123.456.789-09");
    expect(maskDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskDocument("112223330001819999")).toBe("11.222.333/0001-81");
    expect(maskDocument("12.345.678/0001")).toBe("12.345.678/0001");
  });
  it("cep", () => {
    expect(maskCep("78")).toBe("78");
    expect(maskCep("78000000")).toBe("78000-000");
    expect(maskCep("78000-0001")).toBe("78000-000");
  });
});
