import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { Jsonnet } from '@hanazuki/node-jsonnet'
import * as fs from 'fs'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import Ajv from 'ajv'
import { ErrorObject } from 'ajv'
import * as jc from 'json-cycle'


function preprocessJsonSchema_BANG(jsonSchemaObject: Object) {
    if (typeof jsonSchemaObject !== "object") {
        return
    }
    if (jsonSchemaObject["id"] != null) {
        jsonSchemaObject["$id"] = jsonSchemaObject["id"]
        delete jsonSchemaObject["id"]
    }
    Object.keys(jsonSchemaObject).forEach((key) => {
        preprocessJsonSchema_BANG(jsonSchemaObject[key])
    })
}


export async function renderJsonnet(jsonnetSource: string): Promise<any> {
    const jsonnet = new Jsonnet()
    const jsonString = await jsonnet.evaluateSnippet(jsonnetSource)
    const jsonObject = JSON.parse(jsonString)
    let dereferenced = await $RefParser.dereference(jsonObject)
    preprocessJsonSchema_BANG(dereferenced)
    // this may or may not help with schemas with circular defs
    // but Ajv will not work with circular schcemas
    // https://ajv.js.org/security.html#circular-references-in-javascript-objects
    // return jc.decycle(dereferenced)
    return dereferenced
}


export interface ValidationResult {
    data: any
    schema: any
    isValid: boolean
    errors: Array<ErrorObject>
}


export async function validateJsonnetWithSchema(targetDataJsonnet: string, schemaJsonnet: string): Promise<ValidationResult> {
    const jsonnet = new Jsonnet()
    return renderJsonnet(
        schemaJsonnet
    ).then((resolvedJsonSchema) => {
        // HACK: breaks the validator, so forcibly remove the key
        delete resolvedJsonSchema["$schema"]

        const ajv = new Ajv({
            strict: false,
        })
        return renderJsonnet(targetDataJsonnet).then((validationTarget) => {
            return {
                data: validationTarget,
                schema: resolvedJsonSchema,
                isValid: ajv.validate(resolvedJsonSchema, validationTarget),
                errors: ajv.errors
            }
        })
    })
}


if (require.main == module) {
    const argParser = yargs(hideBin(process.argv))
        .options({
            schema: {
                alais: 's',
                type: 'string',
                description: 'path to json(net) json-schema file',
            },
            input: {
                alais: 'i',
                type: 'string',
                description: 'path to input json(net) file to validate against schema',
            }
        })

    const args = argParser.parseSync()
    if (args.schema == null || args.input == null) {
        argParser.showHelp()
        process.exit()
    }

    const schemaJsonnetSource = fs.readFileSync(args.schema, "utf-8")
    const targetDataJsonnetSource = fs.readFileSync(args.input, "utf-8")

    validateJsonnetWithSchema(targetDataJsonnetSource, schemaJsonnetSource).then((result: ValidationResult) => {
        if (result.isValid) {
            console.log(JSON.stringify(result.data, null, 2))
            process.exit(0)
        } else {
            console.error(result.errors)
            process.exit(1)
        }
    })
}
