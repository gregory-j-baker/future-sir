import { useId } from 'react';

import type { RouteHandle } from 'react-router';
import { useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Info, Route } from './+types/send-validation';

import { getSinCaseService } from '~/.server/domain/multi-channel/case-api-service';
import { getLocalizedApplicantGenderById } from '~/.server/domain/person-case/services/applicant-gender-service';
import { getLocalizedApplicantPrimaryDocumentChoiceById } from '~/.server/domain/person-case/services/applicant-primary-document-service';
import { getLocalizedApplicantSecondaryDocumentChoiceById } from '~/.server/domain/person-case/services/applicant-secondary-document-service';
import { getLocalizedApplicantHadSinOptionById } from '~/.server/domain/person-case/services/applicant-sin-service';
import { getLocalizedApplicantStatusInCanadaChoiceById } from '~/.server/domain/person-case/services/applicant-status-in-canada-service';
import { getLocalizedApplicantSupportingDocumentTypeById } from '~/.server/domain/person-case/services/applicant-supporting-document-service';
import { getLocalizedLanguageOfCorrespondenceById } from '~/.server/domain/person-case/services/language-correspondence-service';
import { serverEnvironment } from '~/.server/environment';
import { getLocalizedCountryById } from '~/.server/shared/services/country-service';
import { getLocalizedProvinceById } from '~/.server/shared/services/province-service';
import { requireAllRoles } from '~/.server/utils/auth-utils';
import { i18nRedirect } from '~/.server/utils/route-utils';
import { ContextualAlert } from '~/components/contextual-alert';
import { InlineLink } from '~/components/links';
import { LoadingButton } from '~/components/loading-button';
import { PageTitle } from '~/components/page-title';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { HttpStatusCodes } from '~/errors/http-status-codes';
import { useFetcherState } from '~/hooks/use-fetcher-state';
import { getTranslation } from '~/i18n-config.server';
import { handle as parentHandle } from '~/routes/protected/person-case/layout';
import { ReviewBirthDetails } from '~/routes/protected/sin-application/review-birth-details';
import { ReviewContactInformation } from '~/routes/protected/sin-application/review-contact-information';
import { ReviewCurrentName } from '~/routes/protected/sin-application/review-current-name';
import { ReviewParentDetails } from '~/routes/protected/sin-application/review-parent-details';
import { ReviewPersonalInfo } from '~/routes/protected/sin-application/review-personal-info';
import { ReviewPreviousSin } from '~/routes/protected/sin-application/review-previous-sin';
import { ReviewPrimaryDocs } from '~/routes/protected/sin-application/review-primary-docs';
import { ReviewSecondaryDoc } from '~/routes/protected/sin-application/review-secondary-doc';

export const handle = {
  i18nNamespace: [...parentHandle.i18nNamespace, 'protected'],
} as const satisfies RouteHandle;

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data.documentTitle }];
}

export async function action({ context, params, request }: Route.ActionArgs) {
  requireAllRoles(context.session, new URL(request.url), ['user']);

  // TODO ::: GjB ::: the data returned by the following call should be checked to ensure the logged-in user has permissions to view it
  const personSinCase = await getSinCaseService().findSinCaseById(params.caseId);

  if (personSinCase === undefined) {
    throw new Response(JSON.stringify({ status: HttpStatusCodes.NOT_FOUND, message: 'Case not found' }), {
      status: HttpStatusCodes.NOT_FOUND,
    });
  }

  const formData = await request.formData();
  const action = formData.get('action');

  switch (action) {
    case 'send': {
      throw i18nRedirect('routes/protected/multi-channel/pid-verification.tsx', request, { params });
    }
    default: {
      throw new AppError(`Unrecognized action: ${action}`, ErrorCodes.UNRECOGNIZED_ACTION);
    }
  }
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  requireAllRoles(context.session, new URL(request.url), ['user']);
  const { lang, t } = await getTranslation(request, handle.i18nNamespace);

  // TODO ::: GjB ::: the data returned by the following call should be checked to ensure the logged-in user has permissions to view it
  const personSinCase = await getSinCaseService().findSinCaseById(params.caseId);

  if (personSinCase === undefined) {
    throw new Response(JSON.stringify({ status: HttpStatusCodes.NOT_FOUND, message: 'Case not found' }), {
      status: HttpStatusCodes.NOT_FOUND,
    });
  }

  const {
    birthDetails,
    contactInformation,
    currentNameInfo,
    parentDetails,
    personalInformation,
    previousSin,
    primaryDocuments,
    // TODO - Check why request details is not displayed
    // requestDetails,
    secondaryDocument,
  } = personSinCase;

  return {
    documentTitle: t('protected:send-validation.page-title'),
    caseId: personSinCase.caseId,
    inPersonSINCase: {
      primaryDocuments: {
        ...primaryDocuments,
        currentStatusInCanadaName: getLocalizedApplicantStatusInCanadaChoiceById(primaryDocuments.currentStatusInCanada, lang)
          .name,
        documentTypeName: getLocalizedApplicantPrimaryDocumentChoiceById(primaryDocuments.documentType, lang).name,
        genderName: getLocalizedApplicantGenderById(primaryDocuments.gender, lang).name,
      },
      secondaryDocument: {
        ...secondaryDocument,
        documentTypeName: getLocalizedApplicantSecondaryDocumentChoiceById(secondaryDocument.documentType, lang).name,
      },
      personalInformation: {
        ...personalInformation,
        genderName: getLocalizedApplicantGenderById(personalInformation.gender, lang).name,
      },
      birthDetails: {
        ...birthDetails,
        countryName: getLocalizedCountryById(birthDetails.country, lang).name,
        provinceName: birthDetails.province
          ? birthDetails.country === serverEnvironment.PP_CANADA_COUNTRY_CODE
            ? getLocalizedProvinceById(birthDetails.province, lang).name
            : birthDetails.province
          : undefined,
      },
      parentDetails: parentDetails.map((parentdetail) => ({
        ...parentdetail,
        countryName: parentdetail.unavailable
          ? undefined
          : parentdetail.birthLocation.country && getLocalizedCountryById(parentdetail.birthLocation.country, lang).name,
        provinceName: parentdetail.unavailable
          ? undefined
          : parentdetail.birthLocation.province
            ? parentdetail.birthLocation.country === serverEnvironment.PP_CANADA_COUNTRY_CODE
              ? getLocalizedProvinceById(parentdetail.birthLocation.province, lang).name
              : parentdetail.birthLocation.province
            : undefined,
      })),
      contactInformation: {
        ...contactInformation,
        preferredLanguageName: getLocalizedLanguageOfCorrespondenceById(contactInformation.preferredLanguage, lang).name,
        countryName: getLocalizedCountryById(contactInformation.country, lang).name,
        provinceName:
          contactInformation.country === serverEnvironment.PP_CANADA_COUNTRY_CODE
            ? getLocalizedProvinceById(contactInformation.province, lang).name
            : contactInformation.province,
      },
      previousSin: {
        ...previousSin,
        hasPreviousSinText: getLocalizedApplicantHadSinOptionById(previousSin.hasPreviousSin, lang).name,
      },
      currentNameInfo: {
        ...currentNameInfo,
        firstName: currentNameInfo.preferredSameAsDocumentName ? primaryDocuments.givenName : currentNameInfo.firstName,
        middleName: currentNameInfo.preferredSameAsDocumentName ? undefined : currentNameInfo.middleName,
        lastName: currentNameInfo.preferredSameAsDocumentName ? primaryDocuments.lastName : currentNameInfo.lastName,
        supportingDocuments: currentNameInfo.preferredSameAsDocumentName ? undefined : currentNameInfo.supportingDocuments,
        supportingDocumentsNames: currentNameInfo.preferredSameAsDocumentName
          ? undefined
          : currentNameInfo.supportingDocuments.required
            ? currentNameInfo.supportingDocuments.documentTypes.map(
                (doc) => getLocalizedApplicantSupportingDocumentTypeById(doc, lang).name,
              )
            : undefined,
      },
    },
  };
}

export default function SendValidation({ loaderData, actionData, params }: Route.ComponentProps) {
  const { t } = useTranslation(handle.i18nNamespace);

  const fetcherKey = useId();
  const fetcher = useFetcher<Info['actionData']>({ key: fetcherKey });
  const fetcherState = useFetcherState(fetcher);

  const { inPersonSINCase, caseId } = loaderData;
  const {
    birthDetails,
    contactInformation,
    currentNameInfo,
    parentDetails,
    personalInformation,
    previousSin,
    primaryDocuments,
    secondaryDocument,
  } = inPersonSINCase;

  return (
    <>
      <PageTitle subTitle={t('protected:first-time.title')}>{t('protected:send-validation.page-title')}</PageTitle>
      <ContextualAlert type="info">
        <h3 className="text-lg font-semibold">{t('protected:send-validation.case-created')}</h3>
        <p>{t('protected:send-validation.id-number')}</p>
        <p>{caseId}</p>
      </ContextualAlert>
      <div className="mt-8 max-w-prose space-y-10">
        <ReviewPrimaryDocs
          currentStatusInCanadaName={primaryDocuments.currentStatusInCanadaName}
          documentTypeName={primaryDocuments.documentTypeName}
          registrationNumber={primaryDocuments.registrationNumber}
          clientNumber={primaryDocuments.clientNumber}
          givenName={primaryDocuments.givenName}
          lastName={primaryDocuments.lastName}
          dateOfBirth={primaryDocuments.dateOfBirth}
          genderName={primaryDocuments.genderName}
          citizenshipDate={primaryDocuments.citizenshipDate}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-primary-identity-document')}
          </InlineLink>
        </ReviewPrimaryDocs>
        <ReviewSecondaryDoc
          documentTypeName={secondaryDocument.documentTypeName}
          expiryMonth={secondaryDocument.expiryMonth}
          expiryYear={secondaryDocument.expiryYear}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-secondary-identity-document')}
          </InlineLink>
        </ReviewSecondaryDoc>
        <ReviewCurrentName
          preferredSameAsDocumentName={currentNameInfo.preferredSameAsDocumentName}
          firstName={currentNameInfo.firstName}
          middleName={currentNameInfo.middleName}
          lastName={currentNameInfo.lastName}
          supportingDocuments={currentNameInfo.supportingDocuments}
          supportingDocumentsNames={currentNameInfo.supportingDocumentsNames}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-current-name')}
          </InlineLink>
        </ReviewCurrentName>
        <ReviewPersonalInfo
          firstNamePreviouslyUsed={personalInformation.firstNamePreviouslyUsed}
          lastNameAtBirth={personalInformation.lastNameAtBirth}
          lastNamePreviouslyUsed={personalInformation.lastNamePreviouslyUsed}
          genderName={personalInformation.genderName}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-personal-details')}
          </InlineLink>
        </ReviewPersonalInfo>
        <ReviewBirthDetails
          city={birthDetails.city}
          provinceName={birthDetails.provinceName}
          countryName={birthDetails.countryName}
          fromMultipleBirth={birthDetails.fromMultipleBirth}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-birth-details')}
          </InlineLink>
        </ReviewBirthDetails>
        <ReviewParentDetails parentDetails={parentDetails}>
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-parent-details')}
          </InlineLink>
        </ReviewParentDetails>
        <ReviewPreviousSin
          hasPreviousSinText={previousSin.hasPreviousSinText}
          socialInsuranceNumber={previousSin.socialInsuranceNumber}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-previous-sin')}
          </InlineLink>
        </ReviewPreviousSin>
        <ReviewContactInformation
          preferredLanguageName={contactInformation.preferredLanguageName}
          primaryPhoneNumber={contactInformation.primaryPhoneNumber}
          secondaryPhoneNumber={contactInformation.secondaryPhoneNumber}
          emailAddress={contactInformation.emailAddress}
          countryName={contactInformation.countryName}
          address={contactInformation.address}
          postalCode={contactInformation.postalCode}
          city={contactInformation.city}
          provinceName={contactInformation.provinceName}
        >
          <InlineLink className="mt-6 block" file="routes/protected/request.tsx">
            {t('protected:review.edit-contact-information')}
          </InlineLink>
        </ReviewContactInformation>
      </div>
      <fetcher.Form className="max-w-prose" method="post" noValidate>
        <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <LoadingButton
            name="action"
            value="send"
            variant="primary"
            id="send-for-validation"
            disabled={fetcherState.submitting}
            loading={fetcherState.submitting && fetcherState.action === 'send'}
          >
            {t('protected:send-validation.send-for-validation')}
          </LoadingButton>
        </div>
      </fetcher.Form>
    </>
  );
}
