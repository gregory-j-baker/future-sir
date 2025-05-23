import { parsePhoneNumberWithError } from 'libphonenumber-js';
import * as v from 'valibot';

import { getApplicantGenders } from '~/.server/domain/person-case/services/applicant-gender-service';
import { getApplicantSecondaryDocumentChoices } from '~/.server/domain/person-case/services/applicant-secondary-document-service';
import { getApplicantHadSinOptions } from '~/.server/domain/person-case/services/applicant-sin-service';
import { getApplicantSupportingDocumentTypes } from '~/.server/domain/person-case/services/applicant-supporting-document-service';
import { getApplicationSubmissionScenarios } from '~/.server/domain/person-case/services/application-submission-scenario';
import { getTypesOfApplicationToSubmit } from '~/.server/domain/person-case/services/application-type-service';
import { getLanguagesOfCorrespondence } from '~/.server/domain/person-case/services/language-correspondence-service';
import { serverEnvironment } from '~/.server/environment';
import { getCountries } from '~/.server/shared/services/country-service';
import { getProvinces } from '~/.server/shared/services/province-service';
import { stringToIntegerSchema } from '~/.server/validation/string-to-integer-schema';
import { primaryDocument } from '~/routes/protected/sin-application/validation.server';
import { getStartOfDayInTimezone, toISODateString } from '~/utils/date-utils';
import { REGEX_PATTERNS } from '~/utils/regex-utils';
import { formatSin, isValidSin } from '~/utils/sin-utils';
import { padWithZero } from '~/utils/string-utils';

export const birthDetailsSchema = v.variant(
  'country',
  [
    v.object({
      country: v.literal(serverEnvironment.PP_CANADA_COUNTRY_CODE, 'protected:birth-details.country.invalid-country'),
      province: v.lazy(() =>
        v.picklist(
          getProvinces().map(({ id }) => id),
          'protected:birth-details.province.required-province',
        ),
      ),
      city: v.pipe(
        v.string('protected:birth-details.city.required-city'),
        v.trim(),
        v.nonEmpty('protected:birth-details.city.required-city'),
        v.maxLength(100, 'protected:birth-details.city.invalid-city'),
        v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:birth-details.city.invalid-city'),
      ),
      fromMultipleBirth: v.boolean('protected:birth-details.from-multiple.required-from-multiple'),
    }),
    v.object({
      country: v.pipe(
        v.string('protected:birth-details.country.required-country'),
        v.nonEmpty('protected:birth-details.country.required-country'),
        v.excludes(serverEnvironment.PP_CANADA_COUNTRY_CODE, 'protected:birth-details.country.invalid-country'),
        v.lazy(() =>
          v.picklist(
            getCountries().map(({ id }) => id),
            'protected:birth-details.country.invalid-country',
          ),
        ),
      ),
      province: v.optional(
        v.pipe(
          v.string('protected:birth-details.province.required-province'),
          v.trim(),
          v.nonEmpty('protected:birth-details.province.required-province'),
          v.maxLength(100, 'protected:birth-details.province.invalid-province'),
          v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:birth-details.province.invalid-province'),
        ),
      ),
      city: v.optional(
        v.pipe(
          v.string('protected:birth-details.city.required-city'),
          v.trim(),
          v.nonEmpty('protected:birth-details.city.required-city'),
          v.maxLength(100, 'protected:birth-details.city.invalid-city'),
          v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:birth-details.city.invalid-city'),
        ),
      ),
      fromMultipleBirth: v.boolean('protected:birth-details.from-multiple.required-from-multiple'),
    }),
  ],
  'protected:birth-details.country.required-country',
);

export const contactInformationSchema = v.intersect([
  v.object({
    preferredLanguage: v.lazy(() =>
      v.picklist(
        getLanguagesOfCorrespondence().map(({ id }) => id),
        'protected:contact-information.error-messages.preferred-language-required',
      ),
    ),
    primaryPhoneNumber: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('protected:contact-information.error-messages.primary-phone-required'),
      v.transform((val) => parsePhoneNumberWithError(val, 'CA').formatInternational().replace(/ /g, '')),
    ),
    secondaryPhoneNumber: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.transform((val) => parsePhoneNumberWithError(val, 'CA').formatInternational().replace(/ /g, '')),
      ),
    ),
    emailAddress: v.optional(
      v.pipe(v.string(), v.trim(), v.email('protected:contact-information.error-messages.email-address-invalid-format')),
    ),
  }),
  v.variant(
    'country',
    [
      v.object({
        country: v.literal(serverEnvironment.PP_CANADA_COUNTRY_CODE),
        province: v.lazy(() =>
          v.picklist(
            getProvinces().map(({ id }) => id),
            'protected:contact-information.error-messages.province-required',
          ),
        ),
        address: v.pipe(v.string(), v.trim(), v.nonEmpty('protected:contact-information.error-messages.address-required')),
        postalCode: v.pipe(
          v.string(),
          v.trim(),
          v.nonEmpty('protected:contact-information.error-messages.postal-code-required'),
        ),
        city: v.pipe(v.string(), v.trim(), v.nonEmpty('protected:contact-information.error-messages.city-required')),
      }),
      v.object({
        country: v.lazy(() => v.picklist(getCountries().map(({ id }) => id))),
        province: v.pipe(v.string(), v.trim(), v.nonEmpty('protected:contact-information.error-messages.province-required')),
        address: v.pipe(v.string(), v.trim(), v.nonEmpty('protected:contact-information.error-messages.address-required')),
        postalCode: v.pipe(
          v.string(),
          v.trim(),
          v.nonEmpty('protected:contact-information.error-messages.postal-code-required'),
        ),
        city: v.pipe(v.string(), v.trim(), v.nonEmpty('protected:contact-information.error-messages.city-required')),
      }),
    ],
    'protected:contact-information.error-messages.country-required',
  ),
]);

export const currentNameSchema = v.variant(
  'preferredSameAsDocumentName',
  [
    v.object({ preferredSameAsDocumentName: v.literal(true) }),
    v.object({
      preferredSameAsDocumentName: v.literal(false),
      firstName: v.pipe(
        v.string('protected:current-name.first-name-error.required-error'),
        v.trim(),
        v.nonEmpty('protected:current-name.first-name-error.required-error'),
        v.maxLength(100, 'protected:current-name.first-name-error.max-length-error'),
        v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:current-name.first-name-error.format-error'),
      ),
      middleName: v.optional(
        v.pipe(
          v.string('protected:current-name.middle-name-error.required-error'),
          v.trim(),
          v.maxLength(100, 'protected:current-name.middle-name-error.max-length-error'),
          v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:current-name.middle-name-error.format-error'),
        ),
      ),
      lastName: v.pipe(
        v.string('protected:current-name.last-name-error.required-error'),
        v.trim(),
        v.nonEmpty('protected:current-name.last-name-error.required-error'),
        v.maxLength(100, 'protected:current-name.last-name-error.max-length-error'),
        v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:current-name.last-name-error.format-error'),
      ),
      supportingDocuments: v.variant(
        'required',
        [
          v.object({ required: v.literal(false) }),
          v.object({
            required: v.literal(true),
            documentTypes: v.pipe(
              v.array(
                v.lazy(() =>
                  v.picklist(
                    getApplicantSupportingDocumentTypes().map((doc) => doc.id),
                    'protected:current-name.supporting-error.invalid-error',
                  ),
                ),
              ),
              v.nonEmpty('protected:current-name.supporting-error.required-error'),
              v.checkItems(
                (item, index, array) => array.indexOf(item) === index,
                'protected:current-name.supporting-error.duplicate-error',
              ),
            ),
          }),
        ],
        'protected:current-name.supporting-error.required-error',
      ),
    }),
  ],
  'protected:current-name.preferred-name.required-error',
);

export const maxNumberOfParents = 4;

export const parentDetailsSchema = v.pipe(
  v.array(
    v.variant(
      'unavailable',
      [
        v.object({
          unavailable: v.literal(true),
        }),
        v.object({
          unavailable: v.literal(false),
          givenName: v.pipe(
            v.string('protected:parent-details.given-name-error.required-error'),
            v.trim(),
            v.nonEmpty('protected:parent-details.given-name-error.required-error'),
            v.maxLength(100, 'protected:parent-details.given-name-error.max-length-error'),
            v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:parent-details.given-name-error.format-error'),
          ),
          lastName: v.pipe(
            v.string('protected:parent-details.last-name-error.required-error'),
            v.trim(),
            v.nonEmpty('protected:parent-details.last-name-error.required-error'),
            v.maxLength(100, 'protected:parent-details.last-name-error.max-length-error'),
            v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:parent-details.last-name-error.format-error'),
          ),
          birthLocation: v.variant(
            'country',
            [
              v.object({
                country: v.literal(
                  serverEnvironment.PP_CANADA_COUNTRY_CODE,
                  'protected:parent-details.country-error.invalid-country',
                ),
                province: v.lazy(() =>
                  v.picklist(
                    getProvinces().map(({ id }) => id),
                    'protected:parent-details.province-error.required-province',
                  ),
                ),
                city: v.pipe(
                  v.string('protected:parent-details.city-error.required-city'),
                  v.trim(),
                  v.maxLength(100, 'protected:parent-details.city-error.invalid-city'),
                  v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:parent-details.city-error.invalid-city'),
                ),
              }),
              v.object({
                country: v.pipe(
                  v.string('protected:parent-details.country-error.required-country'),
                  v.excludes(
                    serverEnvironment.PP_CANADA_COUNTRY_CODE,
                    'protected:parent-details.country-error.invalid-country',
                  ),
                  v.lazy(() =>
                    v.picklist(
                      getCountries().map(({ id }) => id),
                      'protected:parent-details.country-error.invalid-country',
                    ),
                  ),
                ),
                province: v.optional(
                  v.pipe(
                    v.string('protected:parent-details.province-error.required-province'),
                    v.trim(),
                    v.maxLength(100, 'protected:parent-details.province-error.invalid-province'),
                    v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:parent-details.province-error.invalid-province'),
                  ),
                ),
                city: v.optional(
                  v.pipe(
                    v.string('protected:parent-details.city-error.required-city'),
                    v.trim(),
                    v.maxLength(100, 'protected:parent-details.city-error.invalid-city'),
                    v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:parent-details.city-error.invalid-city'),
                  ),
                ),
              }),
              v.object({
                country: v.optional(v.pipe(v.string(), v.trim())),
              }),
            ],
            'protected:parent-details.country-error.required-country',
          ),
        }),
      ],
      'protected:parent-details.details-unavailable',
    ),
    'protected:parent-details.details-unavailable',
  ),
  v.minLength(1),
  v.maxLength(maxNumberOfParents),
);

export const personalInfoSchema = v.object({
  firstNamePreviouslyUsed: v.optional(
    v.array(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(100, 'protected:personal-information.first-name-previously-used.max-length'),
        v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:personal-information.first-name-previously-used.format'),
      ),
    ),
  ),
  lastNameAtBirth: v.pipe(
    v.string('protected:personal-information.last-name-at-birth.required'),
    v.trim(),
    v.nonEmpty('protected:personal-information.last-name-at-birth.required'),
    v.maxLength(100, 'protected:personal-information.last-name-at-birth.max-length'),
    v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:personal-information.last-name-at-birth.format'),
  ),
  lastNamePreviouslyUsed: v.optional(
    v.array(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(100, 'protected:personal-information.last-name-previously-used.max-length'),
        v.regex(REGEX_PATTERNS.NON_DIGIT, 'protected:personal-information.last-name-previously-used.format'),
      ),
    ),
  ),
  gender: v.lazy(() =>
    v.picklist(
      getApplicantGenders().map(({ id }) => id),
      'protected:personal-information.gender.required',
    ),
  ),
});

export const previousSinSchema = v.pipe(
  v.object({
    hasPreviousSin: v.lazy(() =>
      v.picklist(
        getApplicantHadSinOptions().map(({ id }) => id),
        'protected:previous-sin.error-messages.has-previous-sin-required',
      ),
    ),
    socialInsuranceNumber: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.check((sin) => isValidSin(sin), 'protected:previous-sin.error-messages.sin-required'),
        v.transform((sin) => formatSin(sin, '')),
      ),
    ),
  }),
  v.forward(
    v.partialCheck(
      [['hasPreviousSin'], ['socialInsuranceNumber']],
      (input) =>
        input.socialInsuranceNumber === undefined ||
        (input.hasPreviousSin === serverEnvironment.PP_HAS_HAD_PREVIOUS_SIN_CODE &&
          isValidSin(input.socialInsuranceNumber ?? '')),
      'protected:previous-sin.error-messages.sin-required',
    ),
    ['socialInsuranceNumber'],
  ),
);

export const primaryDocumentSchema = v.pipe(
  v.intersect([
    v.object({
      currentStatusInCanada: primaryDocument.currentStatusSchema,
    }),
    v.variant(
      'documentType',
      [
        v.object({
          documentType: primaryDocument.documentTypeSchema,
          registrationNumber: primaryDocument.registrationNumberSchema,
          clientNumber: primaryDocument.clientNumberSchema,
          givenName: primaryDocument.givenNameSchema,
          lastName: primaryDocument.lastNameSchema,
          dateOfBirthYear: primaryDocument.dateOfBirthYearSchema,
          dateOfBirthMonth: primaryDocument.dateOfBirthMonthSchema,
          dateOfBirthDay: primaryDocument.dateOfBirthDaySchema,
          dateOfBirth: primaryDocument.dateOfBirthSchema,
          gender: primaryDocument.genderSchema,
          citizenshipDateYear: primaryDocument.citizenshipYearSchema,
          citizenshipDateMonth: primaryDocument.citizenshipMonthSchema,
          citizenshipDateDay: primaryDocument.citizenshipDaySchema,
          citizenshipDate: primaryDocument.citizenshipDateSchema,
        }),
      ],
      'protected:primary-identity-document.document-type.required',
    ),
  ]),
  v.forward(
    v.partialCheck(
      [['dateOfBirth'], ['citizenshipDate']],
      (input) => input.citizenshipDate >= input.dateOfBirth,
      'protected:primary-identity-document.citizenship-date.invalid-before-dob',
    ),
    ['citizenshipDate'],
  ),
);

export function parsePrimaryDocument(formData: FormData) {
  const dateOfBirthYear = formData.get('dateOfBirthYear')?.toString();
  const dateOfBirthMonth = formData.get('dateOfBirthMonth')?.toString();
  const dateOfBirthDay = formData.get('dateOfBirthDay')?.toString();

  const citizenshipDateYear = formData.get('citizenshipDateYear')?.toString();
  const citizenshipDateMonth = formData.get('citizenshipDateMonth')?.toString();
  const citizenshipDateDay = formData.get('citizenshipDateDay')?.toString();

  const formValues = {
    currentStatusInCanada: formData.get('currentStatusInCanada')?.toString(),
    documentType: formData.get('documentType')?.toString(),
    registrationNumber: formData.get('registrationNumber')?.toString(),
    clientNumber: formData.get('clientNumber')?.toString(),
    givenName: formData.get('givenName')?.toString(),
    lastName: formData.get('lastName')?.toString(),
    gender: formData.get('gender')?.toString(),
    dateOfBirthYear: dateOfBirthYear,
    dateOfBirthMonth: dateOfBirthMonth,
    dateOfBirthDay: dateOfBirthDay,
    dateOfBirth: toDateString(dateOfBirthYear, dateOfBirthMonth, dateOfBirthDay),
    citizenshipDateYear: citizenshipDateYear,
    citizenshipDateMonth: citizenshipDateMonth,
    citizenshipDateDay: citizenshipDateDay,
    citizenshipDate: toDateString(citizenshipDateYear, citizenshipDateMonth, citizenshipDateDay),
  };

  return {
    parseResult: v.safeParse(primaryDocumentSchema, formValues),
    formValues: {
      citizenshipDate: formValues.citizenshipDate,
      clientNumber: formValues.clientNumber,
      currentStatusInCanada: formValues.currentStatusInCanada,
      dateOfBirth: formValues.currentStatusInCanada,
      documentType: formValues.documentType,
      gender: formValues.gender,
      givenName: formValues.givenName,
      lastName: formValues.lastName,
      registrationNumber: formValues.registrationNumber,
    },
  };
}

export const privacyStatementSchema = v.object({
  agreedToTerms: v.literal(true, 'protected:privacy-statement.confirm-privacy-notice-checkbox.required'),
});

export const requestDetailsSchema = v.object({
  scenario: v.lazy(() =>
    v.picklist(
      getApplicationSubmissionScenarios().map(({ id }) => id),
      'protected:request-details.required-scenario',
    ),
  ),
  type: v.lazy(() =>
    v.picklist(
      getTypesOfApplicationToSubmit().map(({ id }) => id),
      'protected:request-details.required-request',
    ),
  ),
});

export const secondaryDocumentSchema = v.pipe(
  v.object({
    documentType: v.lazy(() =>
      v.picklist(
        getApplicantSecondaryDocumentChoices().map(({ id }) => id),
        'protected:secondary-identity-document.document-type.invalid',
      ),
    ),
    expiryYear: v.pipe(
      stringToIntegerSchema('protected:secondary-identity-document.expiry-date.required-year'),
      v.minValue(
        getStartOfDayInTimezone(serverEnvironment.BASE_TIMEZONE).getFullYear(),
        'protected:secondary-identity-document.expiry-date.invalid-year',
      ),
      v.transform((year) => padWithZero(year, 4)),
    ),
    expiryMonth: v.pipe(
      stringToIntegerSchema('protected:secondary-identity-document.expiry-date.required-month'),
      v.minValue(1, 'protected:secondary-identity-document.expiry-date.invalid-month'),
      v.maxValue(12, 'protected:secondary-identity-document.expiry-date.invalid-month'),
      v.transform((month) => padWithZero(month, 2)),
    ),
  }),
  v.forward(
    v.partialCheck(
      [['expiryYear'], ['expiryMonth']],
      ({ expiryYear, expiryMonth }) => {
        const currentYear = getStartOfDayInTimezone(serverEnvironment.BASE_TIMEZONE).getFullYear();
        const currentMonth = getStartOfDayInTimezone(serverEnvironment.BASE_TIMEZONE).getMonth() + 1; // JavaScript months are 0-indexed

        const year = Number.parseInt(expiryYear);
        const month = Number.parseInt(expiryMonth);

        if (isNaN(year) || isNaN(month)) {
          return false; // Handle invalid number formats, if necessary
        }

        return year > currentYear || (year === currentYear && month > currentMonth);
      },
      'protected:secondary-identity-document.expiry-date.invalid',
    ),
    ['expiryMonth'],
  ),
);

function toDateString(year?: string, month?: string, day?: string): string {
  try {
    return toISODateString(Number(year), Number(month), Number(day));
  } catch {
    return '';
  }
}
