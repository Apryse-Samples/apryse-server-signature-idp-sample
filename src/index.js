const { PDFNet } = require('@pdftron/pdfnet-node');
const { readdirSync } = require('fs');
const { join } = require('path');
const sharp = require('sharp');
const {calculateMean, calculateStandardDeviation } = require("./util")
const { license_key } = require('../license-key.json');

//CONSTANTS
const INPUT_DIR = join(__dirname, "../files/input");
const OUTPUT_DIR = join(__dirname, "../files/output");
const IDP_MIN_CONFIDENCE = 0.98 //this can be adjusted
const IMAGE_DPI = 300;
const IMAGE_FORMAT = "JPEG";
const THRESHOLD_MULTIPLIER = 1.5;
const THRESHOLD_ACCEPTANCE = 0.04; //5%

const main = async () => {
    const files = readdirSync(INPUT_DIR).filter(file => !file.includes(".empty"));
    const draw = await PDFNet.PDFDraw.create(IMAGE_DPI);

    for(var fileCount = 0; fileCount < files.length; fileCount++){
        const file = files[fileCount];
        const fullPath = join(INPUT_DIR, file);
        const doc = await PDFNet.PDFDoc.createFromFilePath(fullPath);

        const idpResults = JSON.parse(await PDFNet.DataExtractionModule.extractDataAsString(fullPath, PDFNet.DataExtractionModule.DataExtractionEngine.e_Form));
        
        console.log(`File: ${file}`)
        console.log(`####################################################################`)
        //remove eval sheet and fix page order
        const idpPages = idpResults.pages
            .filter(x => !(x.formElements.length == 1 && x.formElements[0].type == "formTextField" && x.formElements[0].confidence == 0.946));
        
        idpPages.forEach((x, index) => x.properties.pageNumber = index + 1);

        //Dictionary to store all the page where we found signature fields
        const pagesWithSignatures = [];

        //Process form fields
        for(var i = 0; i < idpPages.length; i++){
            const idpPage = idpPages[i];

            //Skip pages that we didn't detect any form fields
            if(idpPage.formElements.length > 0){
                //Filter for signature fields and confidence levels
                var signatureFields = idpPage.formElements
                    .filter(formElement => formElement.type == "formDigitalSignature" && formElement.confidence >= IDP_MIN_CONFIDENCE)


                if(signatureFields.length > 0){
                    pagesWithSignatures.push({
                        pageNumber: Number(idpPage.properties.pageNumber),
                        fields: signatureFields
                    })
                }
            }

        }
  
        //Check if page has a wet signature
        for (var pageCount = 0; pageCount < pagesWithSignatures.length; pageCount++) {
            const signaturePage = pagesWithSignatures[pageCount];

            const page = await doc.getPage(signaturePage.pageNumber);
            const imageBuffer = await draw.exportBuffer(page, IMAGE_FORMAT);
            
            for(var fieldCount = 0; fieldCount < signaturePage.fields.length; fieldCount++){
                const field = signaturePage.fields[fieldCount];

                //Convert to grayscale and set pixels to either 0, 255
                const image = sharp(imageBuffer).grayscale().threshold(128);
                
                //Grab PDF points
                const pdfX1 = field.rect[0];
                const pdfY1 = field.rect[1];
                const pdfX2 = field.rect[2];
                const pdfY2 = field.rect[3];

                //Convert to Image coordinates
                const imgX1 = (pdfX1/72) * IMAGE_DPI;
                const imgY1 = (pdfY1/72) * IMAGE_DPI;
                const imgX2 = (pdfX2/72) * IMAGE_DPI;
                const imgY2 = (pdfY2/72) * IMAGE_DPI;
             
                const grayscaleBuffer = await image.extract({
                    left: parseInt(imgX1),
                    top: parseInt(imgY1),
                    width: parseInt(imgX2 - imgX1),
                    height: parseInt(imgY2 - imgY1)
                }).raw().toBuffer();

                const grayscaleValues = Array.from(grayscaleBuffer);

                const mean = calculateMean(grayscaleValues);
                const standardDeviation = calculateStandardDeviation(grayscaleValues);
                const threshold = THRESHOLD_MULTIPLIER * standardDeviation;
                const outliers = grayscaleValues.filter(value => Math.abs(value - mean) > threshold);
                const signatureFound = outliers.length/grayscaleValues.length > THRESHOLD_ACCEPTANCE;

                console.log(`Field: ${fieldCount}`)
                console.log(`Standard Deviation: ${standardDeviation}`)
                console.log(`Threshold: ${threshold}`)
                console.log(`Outliers: ${outliers.length}`)
                console.log(`Grayscale Pixel Count: ${grayscaleValues.length}`)
                console.log(`Signature Found: ${outliers.length/grayscaleValues.length > THRESHOLD_ACCEPTANCE}`)
                console.log(`-----------------------------------------------------`)
                await image.jpeg().toFile(join(OUTPUT_DIR, `${file}_page_${signaturePage.pageNumber}_field_${fieldCount}${signatureFound ? '_signed' : ''}.jpg`))
            }
        }
        console.log(`####################################################################`)
    }
};

PDFNet
.runWithCleanup(main, license_key)
.catch((err) => console.log("Error: ", err))
.then(() => {
    return PDFNet.shutdown();
});