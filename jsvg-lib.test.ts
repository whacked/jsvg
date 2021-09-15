import * as jsvg from './jsvg-lib'
import * as path from 'path'
import * as fs from 'fs'

const TEST_DATA_DIR = path.join(__dirname, 'testdata')


function slurp(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8')
}

function slurpTestData(testFileName: string) {
    return slurp(path.join(TEST_DATA_DIR, testFileName))
}


test('valid jsonnet input', async () => {
    const validJsonnet = slurpTestData('example-json-input-good.jsonnet')
    const testSchema = slurpTestData('example-json-schema.jsonnet')
    return jsvg.validateJsonnetWithSchema(validJsonnet, testSchema).then((result) => {
        expect(result.isValid).toBe(true)
    })
})

test('invalid jsonnet input', async () => {
    const invalidJsonnet = slurpTestData('example-json-input-bad.jsonnet')
    const testSchema = slurpTestData('example-json-schema.jsonnet')
    return jsvg.validateJsonnetWithSchema(invalidJsonnet, testSchema).then((result) => {
        expect(result.isValid).toBe(false)
    })
})