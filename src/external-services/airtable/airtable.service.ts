import { Injectable } from '@nestjs/common';
import Airtable, { FieldSet } from 'airtable';
import { AirtableBase } from 'airtable/lib/airtable_base';
import { Records } from 'airtable/lib/records';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import { AirtableOffer } from './airtable.types';
import {
  manageAirtableResponse,
  mapAirtableOpportunityFields,
} from './airtable.utils';

@Injectable()
export class AirtableService {
  private airtable: AirtableBase;

  constructor(private opportunitiesService: OpportunitiesService) {
    this.airtable = process.env.AIRTABLE_API_KEY
      ? new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
          process.env.AIRTABLE_BASE_ID
        )
      : null;
  }

  async insertOpportunityAirtable(tableName: string, opportunityId: string) {
    const { opportunityUsers, ...opportunity } =
      await this.opportunitiesService.findOne(opportunityId);

    const fields = mapAirtableOpportunityFields(opportunity, opportunityUsers);

    const valuesToInsert = Array.isArray(fields)
      ? fields.map((fieldSet: Partial<AirtableOffer>) => {
          return fieldSet;
        })
      : [fields as Partial<AirtableOffer>];

    return Promise.all(
      valuesToInsert.map((values) => {
        return new Promise((res, rej) => {
          return this.airtable(tableName).create(
            [values],
            { typecast: true },
            (error, records) => {
              return manageAirtableResponse(
                tableName,
                error,
                records,
                res,
                rej
              );
            }
          );
        });
      })
    );
  }

  async updateOpportunityAirtable(tableName: string, opportunityId: string) {
    const { opportunityUsers, ...opportunity } =
      await this.opportunitiesService.findOne(opportunityId);

    const fields = mapAirtableOpportunityFields(opportunity, opportunityUsers);

    const valuesToInsert = Array.isArray(fields)
      ? fields.map((fieldSet: Partial<AirtableOffer>) => {
          return fieldSet;
        })
      : [fields as Partial<AirtableOffer>];

    let isSingleValue = false;

    if (valuesToInsert.length === 1) {
      isSingleValue = true;
    }

    return Promise.all(
      valuesToInsert.map((values) => {
        const opportunityUserId = values.OpportunityUserId
          ? values.OpportunityUserId
          : '';
        const formula = isSingleValue
          ? `{OpportunityId}='${values.OpportunityId}'`
          : `AND({OpportunityUserId}='${opportunityUserId}', {OpportunityId}='${values.OpportunityId}')`;

        return new Promise((res, rej) => {
          return this.airtable(tableName)
            .select({
              filterByFormula: formula,
            })
            .firstPage((err, results) => {
              if (err) {
                return rej(err);
              }

              if (results.length === 0) {
                this.airtable(tableName).create(
                  [values],
                  { typecast: true },
                  (error, records) => {
                    return manageAirtableResponse(
                      tableName,
                      error,
                      records,
                      res,
                      rej
                    );
                  }
                );
              } else {
                Promise.all(
                  results.map((record) => {
                    return new Promise((resolve, reject) => {
                      this.airtable(tableName).update(
                        [
                          {
                            id: record.id,
                            fields: values,
                          },
                        ],
                        { typecast: true },
                        (error, records) => {
                          return manageAirtableResponse(
                            tableName,
                            error,
                            records,
                            resolve,
                            reject
                          );
                        }
                      );
                    });
                  })
                )
                  .then((records) => {
                    return manageAirtableResponse(
                      tableName,
                      null,
                      records as Records<FieldSet>[],
                      res,
                      rej
                    );
                  })
                  .catch((error) => {
                    return manageAirtableResponse(
                      tableName,
                      error,
                      null,
                      res,
                      rej
                    );
                  });
              }
            });
        });
      })
    );
  }
}
