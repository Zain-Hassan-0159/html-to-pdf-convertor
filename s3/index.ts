import * as aws from "@pulumi/aws";

//const provider = new aws.Provider("provider", { region: 'us-east-1' });
const provider = new aws.Provider("provider", { region: 'us-east-2' });

export const pdfBucket = new aws.s3.Bucket("catalog-arrow", {
    bucket: "catalog-arrow",
    acl: 'private',
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Sid: 'AllowPutObjectForLambda',
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com'
                },
                Action: 's3:PutObject',
                Resource: `arn:aws:s3:::catalog-arrow/in/*`
            },
            {
                Sid: 'AllowPutObjectForLambda',
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com'
                },
                Action: 's3:PutObject',
                Resource: `arn:aws:s3:::catalog-arrow/out/*`
            },
            {
                Sid: 'AllowGetObjectForLambda',
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com'
                },
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::catalog-arrow/in/*`
            },
            {
                Sid: 'AllowGetObjectForLambda',
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com'
                },
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::catalog-arrow/out/*`
            },
        ],
    }),
}, { provider });

