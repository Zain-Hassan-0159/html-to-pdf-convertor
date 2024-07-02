import * as aws from "@pulumi/aws";
import { Queues } from "../sqs";
import { pdfBucket } from "../s3";
import { ManagedPolicies } from "@pulumi/aws/iam";

const sqs = new aws.sdk.SQS({ region: "us-east-2" });

const generatePdf = async (content: string): Promise<Buffer> => {
  const chromium = require('chrome-aws-lambda');
  let browser: any = undefined;
  try {
    // launch a headless chrome instance
    const executablePath = await chromium.executablePath;
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: false,
      defaultViewport: chromium.defaultViewport,
    });

    // get the HTML file from the S3 bucket
    const s3 = new aws.sdk.S3({ region: "us-east-2" });
    const s3Object = await s3.getObject({
      Bucket: pdfBucket.bucket.get(),
      Key: `in/${content}.html`,
    }).promise();
    
    const html = s3Object.Body?.toString();
    
    // create a new page
    const page = await browser.newPage();


    // set the content of the page
    await page.setContent(html);

    // generate the pdf as a buffer and return it
    return (await page.pdf({  printBackground: true })) as Buffer; // format: "A4",
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    if (browser !== undefined) {
      // close the browser
      await browser.close();
    }
  }
};


export const pdfProcessingLambda = new aws.lambda.CallbackFunction("pdfProcessingLambda", {
  callback: async (event: aws.sqs.QueueEvent) => {
    const processedEventPromises = event.Records.map(async (record) => {
      const { messageId, body, receiptHandle } = record;
      const { content } = JSON.parse(body) as {
        content: string;
      };

      // generate pdf
      const pdf = await generatePdf(content);

      const pdfName = `${messageId}.pdf`;

      // upload pdf to s3
      const s3 = new aws.sdk.S3({ region: "us-east-2" });
      await s3.putObject({
        Bucket: pdfBucket.bucket.get(),
        Key: `out/${pdfName}`,
        Body: pdf,
        ContentType: "application/pdf",
      }).promise();

      // generate signed url from s3 for public reads.
      const signedUrl = await s3.getSignedUrlPromise("getObject", {
        Bucket: pdfBucket.bucket.get(),
        Key: `out/${pdfName}`,
        Expires: 60 * 60 * 24 * 7, // 7 days
      });

      // delete message from queue
      await sqs.deleteMessage({ QueueUrl: Queues.pdfProcessingQueue.url.get(), ReceiptHandle: receiptHandle }).promise();
      console.log(`Deleted message ${messageId} from queue`);
    });
    await Promise.all(processedEventPromises);
  },
  memorySize: 2048,
  runtime: aws.lambda.Runtime.NodeJS14dX,
  timeout: 30,
  layers: ['arn:aws:lambda:us-east-1:764398688170:layer:pdfLayer:1'],
  policies: [ManagedPolicies.AmazonSESFullAccess, ManagedPolicies.AmazonS3FullAccess, ManagedPolicies.AmazonSQSFullAccess, ManagedPolicies.AWSLambdaBasicExecutionRole, ManagedPolicies.CloudWatchFullAccess],
});
