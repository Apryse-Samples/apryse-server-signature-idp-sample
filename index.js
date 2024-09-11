const { PDFNet } = require('@pdftron/pdfnet-node');  // you may need to set up NODE_PATH environment variable to make this work.
const { readdirSync } = require('fs');
const { join } = require('path');

const INPUT_DIR = join(__dirname, "files/input");
const OUTPUT_DIR = join(__dirname, "files/output");

const main = async () => {
    const files = readdirSync(INPUT_DIR).filter(file => !file.includes(".empty"));

    files.forEach(async (file) => {
        const fullPath = path.join(INPUT_DIR, file);
        const json = await PDFNet.DataExtractionModule.extractDataAsString(fullPath, PDFNet.DataExtractionModule.DataExtractionEngine.e_Form);
        console.log(json)
    })
};

// add your own license key as the second parameter, e.g. in place of 'YOUR_LICENSE_KEY'.
PDFNet
.runWithCleanup(main, 'LICENSE_KEY')
.then(function(){ 
    return PDFNet.shutdown(); 
});