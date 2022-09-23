/* eslint-disable no-console */
// eslint-disable no-console

import { FieldSet } from 'airtable';
import AirtableError from 'airtable/lib/airtable_error';
import { Records } from 'airtable/lib/records';
import * as _ from 'lodash';
import { BusinessLineFilters } from 'src/common/businessLines/businessLines.types';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { ExternalOfferOriginFilters } from 'src/opportunities/opportunities.types';
import { findOfferStatus } from 'src/opportunities/opportunities.utils';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AnyCantFix } from 'src/utils/types';
import { AirtableOffer } from './airtable.types';

export function manageAirtableResponse(
  tableName: string,
  error: AirtableError,
  records: Records<FieldSet> | Records<FieldSet>[],
  res: (value: AnyCantFix) => void,
  rej: (reason?: AnyCantFix) => void
) {
  if (error) {
    console.error(error);
    return rej(
      `An error has occured while filling Airtable table '${tableName}'`
    );
  }
  records.forEach((rec) => {
    if (Array.isArray(rec)) {
      rec.forEach((r) => {
        console.log('Airtable record id : ', r.getId());
      });
    } else {
      console.log(
        'Airtable record id : ',
        (rec as Records<FieldSet>[number]).getId()
      );
    }
  });
  return res(records);
}

export function mapAirtableOpportunityFields(
  opportunity: Partial<Opportunity>,
  candidates: Partial<OpportunityUser>[]
): AirtableOffer | AirtableOffer[] {
  const commonFields = {
    OpportunityId: opportunity.id,
    Entreprise: opportunity.company,
    Titre: opportunity.title,
    Nom: opportunity.recruiterName,
    Prénom: opportunity.recruiterFirstName,
    Mail: opportunity.recruiterMail,
    'Contact mail': opportunity.contactMail,
    Téléphone: opportunity.recruiterPhone,
    Fonction: opportunity.recruiterPosition,
    'Description poste': opportunity.description,
    'Description entreprise': opportunity.companyDescription,
    'Compétences requises': opportunity.skills,
    'Pré-requis': opportunity.prerequisites,
    "Secteur d'activité": _.uniq(
      opportunity.businessLines.map(({ name }) => {
        return findConstantFromValue(name, BusinessLineFilters).label;
      })
    ),
    Publique: opportunity.isPublic,
    Externe: opportunity.isExternal,
    'Lien externe': opportunity.link,
    'Origine externe': findConstantFromValue(
      opportunity.externalOrigin,
      ExternalOfferOriginFilters
    ).label,
    Validé: opportunity.isValidated,
    Archivé: opportunity.isArchived,
    'Date de création': opportunity.createdAt.toString(),
    Département: opportunity.department,
    Adresse: opportunity.address,
    Contrat: findConstantFromValue(opportunity.contract, ContractFilters).label,
    'Début de contrat': opportunity.startOfContract.toString(),
    'Fin de contrat': opportunity.endOfContract.toString(),
    'Temps partiel ?': opportunity.isPartTime,
    'Nombre de postes': opportunity.numberOfPositions,
    'Souhaite être recontacté': opportunity.beContacted,
    'Message personnalisé': opportunity.message,
    'Permis de conduire': opportunity.driversLicense,
    'Jours et horaires': opportunity.workingHours,
    Salaire: opportunity.salary,
    'Autres précisions': opportunity.otherInfo,
  };

  return candidates && candidates.length > 0
    ? [
        ...candidates.map((candidate) => {
          const offerStatus = findOfferStatus(
            candidate.status,
            opportunity.isPublic,
            candidate.recommended
          );

          return {
            ...commonFields,
            OpportunityUserId: candidate.id,
            Candidat: `${candidate.user.firstName} ${candidate.user.lastName}`,
            Statut: offerStatus.label,
            Commentaire: candidate.note,
            'Recommandée ?': candidate.recommended,
          };
        }),
        commonFields,
      ]
    : commonFields;
}
