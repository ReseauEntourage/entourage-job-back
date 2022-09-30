import * as _ from 'lodash';
import { BusinessLineFilters } from 'src/common/businessLines/businessLines.types';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Department } from 'src/common/locations/locations.types';
import { OpportunityUser } from 'src/opportunities/models';
import { ExternalOfferOriginFilters } from 'src/opportunities/opportunities.types';
import { findOfferStatus } from 'src/opportunities/opportunities.utils';
import { getZoneSuffixFromDepartment } from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AdminZones } from 'src/utils/types';
import {
  OfferProps,
  ProcessProps,
  SalesforceOffer,
  SalesforceProcess,
} from './salesforce.types';

export function formatBusinessLines(businessLines: BusinessLine[]) {
  return _.uniq(
    businessLines.map(({ name }) => {
      return findConstantFromValue(name, BusinessLineFilters).label;
    })
  )
    .toString()
    .replace(',', ';');
}

export function formatDepartment(department: Department) {
  if (!department) {
    return 'National';
  }
  return _.capitalize(AdminZones[getZoneSuffixFromDepartment(department)]);
}

export function formatCompanyName(
  name: string,
  address: string,
  department: Department
) {
  return `${name} - ${address} - ${department}`;
}

export function parseAddress(address: string) {
  if (address) {
    const parsedPostalCode = address.match(/\d{5}/gi);

    if (parsedPostalCode && parsedPostalCode.length > 0) {
      const postalCode = parsedPostalCode[0];
      const parsedAddress = address.split(postalCode);
      return {
        street: parsedAddress[0]?.replace(',', '').trim(),
        city: parsedAddress[1]?.replace(',', '').trim(),
        postalCode: parsedPostalCode[0],
      };
    } else {
      const number = address.match(/\d*,/gi);

      if (number) {
        const parsedStreet = address
          .replace(number[0], number[0].replace(',', ''))
          .split(',');

        return {
          street: parsedStreet[0]?.replace(',', '').trim(),
          city: parsedStreet[1]?.replace(',', '').trim(),
        };
      }
      return { street: address.replace(',', '').trim() };
    }
  }
  return {
    street: '',
    city: '',
    postalCode: '',
  };
}

export function mapSalesforceOfferFields({
  id,
  company,
  title,
  businessLines,
  contract,
  isPartTime,
  isPublic,
  isExternal,
  link,
  isValidated,
  isArchived,
  department,
  address,
  workingHours,
  salary,
  message,
  companyDescription,
  description,
  otherInfo,
  driversLicense,
  externalOrigin,
  recruiterFirstName,
  recruiterName,
  recruiterMail,
  recruiterPhone,
  recruiterPosition,
  contactMail,
  companySfId,
  contactSfId,
}: OfferProps): SalesforceOffer {
  const externalOriginConstant = externalOrigin
    ? findConstantFromValue(externalOrigin, ExternalOfferOriginFilters)
    : null;

  return {
    ID__c: id,
    Name: `${title} - ${formatCompanyName(company, address, department)}`,
    Titre__c: title,
    Entreprise_Recruteuse__c: companySfId,
    Secteur_d_activite_de_l_offre__c: formatBusinessLines(businessLines),
    Type_de_contrat__c: findConstantFromValue(contract, ContractFilters).label,
    Temps_partiel__c: isPartTime,
    Offre_publique__c: isPublic,
    Offre_externe__c: isExternal,
    Offre_archivee__c: isArchived,
    Offre_valid_e__c: isValidated,
    Lien_externe__c: link,
    Lien_Offre_Backoffice__c:
      process.env.FRONT_URL + '/backoffice/admin/offres/' + id,
    Departement__c: department,
    Adresse_de_l_offre__c: address,
    Jours_et_horaires_de_travail__c: workingHours,
    Salaire_et_complement__c: salary,
    Message_au_candidat__c: message,
    Presentation_de_l_entreprise__c: companyDescription,
    Descriptif_des_missions_proposees__c: description,
    Autre_precision_sur_votre_besoin__c: otherInfo,
    Permis_de_conduire_necessaire__c: driversLicense,
    Source_de_l_offre__c:
      externalOriginConstant?.salesforceLabel || externalOriginConstant?.label,
    Nom__c: recruiterName,
    Prenom__c: recruiterFirstName,
    Mail_du_recruteur__c: recruiterMail,
    Telephone_du_recruteur__c: recruiterPhone,
    Fonction_du_recruteur__c: recruiterPosition,
    Mail_de_contact__c: contactMail,
    Prenom_Nom_du_recruteur__c: contactSfId,
    Contact_cree_existant__c: true,
    Antenne__c: _.capitalize(
      AdminZones[getZoneSuffixFromDepartment(department)]
    ),
  };
}

export function mapSalesforceProcessFields({
  id,
  firstName,
  lastName,
  company,
  isPublic,
  status,
  seen,
  bookmarked,
  archived,
  recommended,
  offerTitle,
  binomeSfId,
  offerSfId,
}: ProcessProps): SalesforceProcess {
  return {
    ID_Externe__c: id,
    Name: `${firstName} ${lastName} - ${offerTitle} - ${company}`,
    Statut__c: findOfferStatus(status, isPublic, recommended).label,
    Vue__c: seen,
    Favoris__c: bookmarked,
    Archivee__c: archived,
    Recommandee__c: recommended,
    Binome__c: binomeSfId,
    Offre_d_emploi__c: offerSfId,
  };
}

export function mapProcessFromOpportunityUser(
  opportunityUsers: OpportunityUser[],
  id: string,
  title: string,
  company: string
): Partial<ProcessProps>[] {
  return opportunityUsers.map(
    ({ UserId, user: { email, firstName, lastName }, ...restProps }) => {
      return {
        offerTitle: title,
        candidateEmail: email,
        firstName,
        lastName,
        company,
        ...restProps,
      };
    }
  );
}
