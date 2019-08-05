import { ICommon } from '@serverless-di/core';
import { isValidDynamoItem, createDynamoItem } from '../utils/aws';
import { injectable } from 'inversify';
import * as AWS from 'aws-sdk';

@injectable()
export class Table {
  name: string;
  region: string;
  primaryKeys: ICommon.PrimaryKeys;
  options: ICommon.TableOptions = <any>{}; // By default strict is turned off
  constructor() {}

  init(
    name: string,
    region: string,
    primaryKeys: ICommon.PrimaryKeys,
    options?: ICommon.TableOptions
  ) {
    this.name = name;
    this.region = region;
    this.primaryKeys = primaryKeys;
    this.options.strict = options.strict || false;
    this.options.returnConsumedCapacity = options.returnConsumedCapacity || 'TOTAL';
    this.options.returnItemCollectionMetrics = options.returnItemCollectionMetrics || 'NONE';
    this.options.returnValues = options.returnValues || 'ALL_NEW';
  }
  /**
   *
   * @param payload Data to put against given partitionKey
   * @param options Configuration Options
   */
  async putAll(
    payload: Array<any>,
    options?: {
      strict?: boolean;
      returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE';
      returnItemCollectionMetrics?: 'SIZE' | 'NONE';
      returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
    }
  ) {
    // if no strict provided use default value for strict

    if (!options.strict) {
      options.strict = this.options.strict;
    }
    const documentClient = new AWS.DynamoDB.DocumentClient();
    const items = { valid: [], invalid: [] };

    payload.reduce((acc, curr) => {
      // Verify item, if valid item return otherwise
      if (isValidDynamoItem(this.primaryKeys, curr)) {
        acc.valid.push(curr);
      } else {
        acc.invalid.push(curr);
      }
      return acc;
    }, items);

    if (items.invalid.length && options.strict) {
      throw new Error('Could not process items, one or more items are invalid');
    }

    const putRequests = items.valid.reduce((accu, curr) => {
      const requestItem = {
        PutRequest: {
          Item: createDynamoItem(curr)
        }
      };
      accu.push(requestItem);
      return accu;
    }, []);

    const params = {
      RequestItems: {
        [this.name]: putRequests
      }
    };

    return documentClient.batchWrite(params).promise();
  }
}
