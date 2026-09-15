/* eslint-disable */
/**
 * Sinh module CRUD từ file đặc tả, theo đúng khuôn của `aisoft base <entity> sql`.
 *
 *   node tools/generate-module.js tools/specs/<file>.js
 *
 * Sinh 11 file mỗi module và tự đăng ký vào:
 *   - src/modules/repository/common/entity.ts
 *   - src/modules/repository/sequelize/common/sequelize-model.ts
 *   - src/app.module.ts
 *
 * Chạy lại trên cùng đặc tả sẽ ghi đè, nên đây là cách sửa cột: sửa đặc tả
 * rồi chạy lại, không sửa tay từng file.
 *
 * Định dạng đặc tả: xem tools/specs/*.js
 * Kiểu cột: string | text | int | decimal | bool | date | json
 *
 * Lưu ý: generator KHÔNG sinh foreign key. Mọi quan hệ là cột string + index,
 * nên thêm cột trỏ tới bảng chưa tồn tại là an toàn.
 */
const fs = require("fs");
const path = require("path");

const specPath = process.argv[2];
if (!specPath) {
    console.error("Thiếu đường dẫn đặc tả: node tools/generate-module.js tools/specs/<file>.js");
    process.exit(1);
}
const specs = require(path.resolve(specPath));

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

/* ------------------------------------------------------------ helpers */
const pascal = (k) => k.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const camel = (s) => s[0].toLowerCase() + s.slice(1);
const CONST = (k) => k.replace(/-/g, "_").toUpperCase();

const write = (p, content) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf8");
};

const TS_TYPE = {
    string: "string", text: "string", int: "number",
    decimal: "number", bool: "boolean", date: "Date",
    json: "Record<string, any>",
};
const SQL_TYPE = {
    string: "DataType.STRING", text: "DataType.TEXT", int: "DataType.INTEGER",
    decimal: "DataType.FLOAT", bool: "DataType.BOOLEAN", date: "DataType.DATE",
    json: "DataType.JSONB",
};

const tsTypeOf = (f) => {
    if (f.enum) return f.enum;
    if (f.type === "json") return f.array ? "Record<string, any>[]" : TS_TYPE.json;
    return TS_TYPE[f.type];
};

const validatorOf = (f) => {
    if (f.enum) return { dec: `@IsEnum(${f.enum})`, imp: "IsEnum" };
    switch (f.type) {
        case "string":
        case "text": return { dec: "@IsString()", imp: "IsString" };
        case "int": return { dec: "@IsInt()", imp: "IsInt" };
        case "decimal": return { dec: "@IsNumber()", imp: "IsNumber" };
        case "bool": return { dec: "@IsBoolean()", imp: "IsBoolean" };
        case "date": return { dec: "@IsDateString()", imp: "IsDateString" };
        case "json":
            return f.array
                ? { dec: "@IsArray()", imp: "IsArray" }
                : { dec: "@IsObject()", imp: "IsObject" };
    }
};

/* ------------------------------------------------------------ builders */
function buildConstant(spec) {
    const enums = spec.enums || {};
    const names = Object.keys(enums);
    if (!names.length) return null;
    return names.map((n) => {
        const members = Object.entries(enums[n])
            .map(([k, v]) => `    ${k} = "${v}",`).join("\n");
        return `export enum ${n} {\n${members}\n}`;
    }).join("\n\n") + "\n";
}

function buildEntity(spec) {
    const Cls = pascal(spec.name);
    const validators = new Set(["IsOptional", "IsString"]);
    if (spec.softDelete) validators.add("IsDateString");

    const props = spec.fields.map((f) => {
        const v = validatorOf(f);
        validators.add(v.imp);
        const lines = [`    /**`, `     * ${f.label}`, `     */`, `    ${v.dec}`];
        if (!f.required) lines.push(`    @IsOptional()`);
        const def = [`label: "${f.label}"`];
        if (f.required) def.push("required: true");
        if (f.enum) def.push(`enum: Object.values(${f.enum})`);
        lines.push(`    @EntityDefinition.field({ ${def.join(", ")} })`);
        lines.push(`    ${f.name}${f.required ? "" : "?"}: ${tsTypeOf(f)};`);
        return lines.join("\n");
    }).join("\n\n");

    const enumNames = Object.keys(spec.enums || {});
    const imports = [
        `import { EntityDefinition } from "@common/constant/class/entity-definition";`,
        `import { BaseEntity } from "@common/interface/base-entity.interface";`,
        `import { ${[...validators].sort().join(", ")} } from "class-validator";`,
    ];
    if (enumNames.length) {
        imports.push(`import { ${enumNames.sort().join(", ")} } from "../common/constant";`);
    }

    const deleted = spec.softDelete
        ? `\n\n    /**\n     * Thời điểm xóa mềm\n     */\n    @IsOptional()\n    @IsDateString()\n    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })\n    deletedAt?: Date;`
        : "";

    return `${imports.join("\n")}

export class ${Cls} implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

${props}${deleted}
}
`;
}

function buildModel(spec) {
    const Cls = pascal(spec.name);
    const enumNames = Object.keys(spec.enums || {});

    const props = spec.fields.map((f) =>
        `    @Column({ type: ${SQL_TYPE[f.type]}, allowNull: ${f.required ? "false" : "true"} })\n` +
        `    ${f.name}${f.required ? "" : "?"}: ${tsTypeOf(f)};`
    ).join("\n\n");

    const tableOpts = [`tableName: "${spec.table}"`, "timestamps: true"];
    if (spec.timestamps === "createdOnly") tableOpts.push("updatedAt: false");
    if (spec.softDelete) tableOpts.push("paranoid: true");
    if (spec.indexes?.length) {
        const idx = spec.indexes.map((i) =>
            `        { fields: [${i.fields.map((x) => `"${x}"`).join(", ")}]${i.unique ? ", unique: true" : ""} },`
        ).join("\n");
        tableOpts.push(`indexes: [\n${idx}\n    ]`);
    }

    const imports = [
        `import { StrObjectId } from "@common/constant";`,
        `import { Column, DataType, Model, Table } from "sequelize-typescript";`,
        `import { ${Cls} } from "../entities/${spec.name}.entity";`,
    ];
    if (enumNames.length) {
        imports.push(`import { ${enumNames.sort().join(", ")} } from "../common/constant";`);
    }

    const deleted = spec.softDelete
        ? `\n\n    @Column({ type: DataType.DATE, allowNull: true })\n    deletedAt?: Date;`
        : "";

    return `${imports.join("\n")}

@Table({
    ${tableOpts.join(",\n    ")},
})
export class ${Cls}Model extends Model implements ${Cls} {
    @StrObjectId()
    _id: string;

${props}${deleted}
}
`;
}

const buildConditionDto = (s) => `import { PartialType } from "@nestjs/swagger";
import { ${pascal(s.name)} } from "../entities/${s.name}.entity";

export class ${pascal(s.name)}ConditionDto extends PartialType(${pascal(s.name)}) {}
`;

const buildCreateDto = (s) => `import { OmitType } from "@nestjs/swagger";
import { ${pascal(s.name)} } from "../entities/${s.name}.entity";

export class Create${pascal(s.name)}Dto extends OmitType(${pascal(s.name)}, ["_id"] as const) {}
`;

const buildUpdateDto = (s) => `import { PartialType } from "@nestjs/swagger";
import { Create${pascal(s.name)}Dto } from "./create-${s.name}.dto";

export class Update${pascal(s.name)}Dto extends PartialType(Create${pascal(s.name)}Dto) {}
`;

const buildRepoInterface = (s) => `import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { ${pascal(s.name)} } from "../entities/${s.name}.entity";

export type ${pascal(s.name)}Repository = BaseRepository<${pascal(s.name)}>;
`;

function buildSqlRepository(spec) {
    const Cls = pascal(spec.name);
    return `import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ${Cls} } from "../entities/${spec.name}.entity";
import { ${Cls}Model } from "../models/${spec.name}.model";
import { ${Cls}Repository } from "./${spec.name}-repository.interface";

@Injectable()
export class ${Cls}SqlRepository
    extends SqlRepository<${Cls}>
    implements ${Cls}Repository
{
    constructor(
        @InjectModel(${Cls}Model)
        private readonly ${camel(Cls)}Model: ModelCtor<${Cls}Model>,
    ) {
        super(${camel(Cls)}Model);
    }
}
`;
}

function buildService(spec) {
    const Cls = pascal(spec.name);
    return `import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ${Cls} } from "../entities/${spec.name}.entity";
import { ${Cls}Repository } from "../repositories/${spec.name}-repository.interface";

@Injectable()
export class ${Cls}Service extends BaseService<${Cls}, ${Cls}Repository> {
    constructor(
        @InjectRepository(Entity.${CONST(spec.name)})
        private readonly ${camel(Cls)}Repository: ${Cls}Repository,
    ) {
        super(${camel(Cls)}Repository);
    }
}
`;
}

function buildController(spec) {
    const Cls = pascal(spec.name);
    const perm = spec.permission
        ? `\n        permission: "${spec.permission}",`
        : "";
    return `import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Create${Cls}Dto } from "../dto/create-${spec.name}.dto";
import { ${Cls}ConditionDto } from "../dto/${spec.name}-condition.dto";
import { Update${Cls}Dto } from "../dto/update-${spec.name}.dto";
import { ${Cls} } from "../entities/${spec.name}.entity";
import { ${Cls}Service } from "../services/${spec.name}.service";

@Controller("${spec.name}")
@ApiTags("${spec.name}")
export class ${Cls}Controller extends BaseControllerFactory<${Cls}>(
    ${Cls},
    ${Cls}ConditionDto,
    Create${Cls}Dto,
    Update${Cls}Dto,
    {
        import: { enable: false },${perm}
    },
) {
    constructor(private readonly ${camel(Cls)}Service: ${Cls}Service) {
        super(${camel(Cls)}Service);
    }
}
`;
}

function buildModule(spec) {
    const Cls = pascal(spec.name);
    return `import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ${Cls}Controller } from "./controllers/${spec.name}.controller";
import { ${Cls}SqlRepository } from "./repositories/${spec.name}-sql.repository";
import { ${Cls}Service } from "./services/${spec.name}.service";

@Module({
    controllers: [${Cls}Controller],
    providers: [
        ${Cls}Service,
        RepositoryProvider(Entity.${CONST(spec.name)}, ${Cls}SqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [${Cls}Service],
})
export class ${Cls}Module {}
`;
}

/* ------------------------------------------------------------ generate */
for (const spec of specs) {
    const dir = path.join(SRC, "modules", spec.name);
    const c = buildConstant(spec);
    const constantPath = path.join(dir, "common", "constant.ts");
    if (c) write(constantPath, c);
    else if (fs.existsSync(constantPath)) fs.unlinkSync(constantPath);

    write(path.join(dir, "entities", `${spec.name}.entity.ts`), buildEntity(spec));
    write(path.join(dir, "models", `${spec.name}.model.ts`), buildModel(spec));
    write(path.join(dir, "dto", `${spec.name}-condition.dto.ts`), buildConditionDto(spec));
    write(path.join(dir, "dto", `create-${spec.name}.dto.ts`), buildCreateDto(spec));
    write(path.join(dir, "dto", `update-${spec.name}.dto.ts`), buildUpdateDto(spec));
    write(path.join(dir, "repositories", `${spec.name}-repository.interface.ts`), buildRepoInterface(spec));
    write(path.join(dir, "repositories", `${spec.name}-sql.repository.ts`), buildSqlRepository(spec));
    write(path.join(dir, "services", `${spec.name}.service.ts`), buildService(spec));
    if (!spec.keepController) {
        write(path.join(dir, "controllers", `${spec.name}.controller.ts`), buildController(spec));
    }
    write(path.join(dir, `${spec.name}.module.ts`), buildModule(spec));
}

/* -------------------------------------------- đăng ký: entity.ts */
{
    const p = path.join(SRC, "modules/repository/common/entity.ts");
    let src = fs.readFileSync(p, "utf8");
    const missing = specs.filter(
        (s) => !new RegExp(`^export const ${CONST(s.name)} =`, "m").test(src),
    );
    if (missing.length) {
        src = src.trimEnd() + "\n" +
            missing.map((s) => `export const ${CONST(s.name)} = "${pascal(s.name)}";`).join("\n") + "\n";
        fs.writeFileSync(p, src, "utf8");
    }
}

/* ------------------------------ đăng ký: sequelize-model.ts */
{
    const p = path.join(SRC, "modules/repository/sequelize/common/sequelize-model.ts");
    let src = fs.readFileSync(p, "utf8");
    const imports = specs
        .map((s) => `import { ${pascal(s.name)}Model } from "@module/${s.name}/models/${s.name}.model";`)
        .filter((l) => !src.includes(l)).join("\n");
    if (imports) src = imports + "\n" + src;
    const entries = specs.map((s) => `${pascal(s.name)}Model`)
        .filter((n) => !new RegExp(`^\\s+${n},`, "m").test(src));
    if (entries.length) {
        src = src.replace(/\n\];\s*$/, "\n" + entries.map((n) => `    ${n},`).join("\n") + "\n];\n");
    }
    fs.writeFileSync(p, src, "utf8");
}

/* ------------------------------------------ đăng ký: app.module.ts */
{
    const p = path.join(SRC, "app.module.ts");
    let src = fs.readFileSync(p, "utf8");
    const imports = specs
        .map((s) => `import { ${pascal(s.name)}Module } from "@module/${s.name}/${s.name}.module";`)
        .filter((l) => !src.includes(l)).join("\n");
    if (imports) src = imports + "\n" + src;
    const entries = specs.map((s) => `${pascal(s.name)}Module`)
        .filter((n) => !new RegExp(`^\\s+${n},`, "m").test(src));
    if (entries.length) {
        src = src.replace(
            /(imports:\s*\[)([\s\S]*?)(\n\s*\],)/,
            (m, a, body, c) => a + body + "\n" + entries.map((n) => `        ${n},`).join("\n") + c,
        );
    }
    fs.writeFileSync(p, src, "utf8");
}

console.log(`Đã sinh ${specs.length} module từ ${specPath}`);
