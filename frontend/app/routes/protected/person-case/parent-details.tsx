import { useId, useState } from 'react';

import type { RouteHandle } from 'react-router';
import { data, redirect, useFetcher } from 'react-router';

import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as v from 'valibot';

import type { Info, Route } from './+types/parent-details';

import { getLocalizedCountries } from '~/.server/shared/services/country-service';
import { getLocalizedProvinces } from '~/.server/shared/services/province-service';
import { requireAllRoles } from '~/.server/utils/auth-utils';
import { Button } from '~/components/button';
import { FetcherErrorSummary } from '~/components/error-summary';
import { InputCheckbox } from '~/components/input-checkbox';
import { InputField } from '~/components/input-field';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { PageTitle } from '~/components/page-title';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { HttpStatusCodes } from '~/errors/http-status-codes';
import { useFetcherState } from '~/hooks/use-fetcher-state';
import { getTranslation } from '~/i18n-config.server';
import { handle as parentHandle } from '~/routes/protected/person-case/layout';
import { getTabIdOrRedirect, loadMachineActorOrRedirect } from '~/routes/protected/person-case/route-helpers.server';
import { getStateRoute } from '~/routes/protected/person-case/state-machine.server';
import { maxNumberOfParents, parentDetailsSchema } from '~/routes/protected/person-case/validation.server';
import { trimToUndefined } from '~/utils/string-utils';
import { extractValidationKey } from '~/utils/validation-utils';

export const handle = {
  i18nNamespace: [...parentHandle.i18nNamespace, 'protected'],
} as const satisfies RouteHandle;

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data.documentTitle }];
}

export async function action({ context, params, request }: Route.ActionArgs) {
  requireAllRoles(context.session, new URL(request.url), ['user']);

  const tabId = getTabIdOrRedirect(request);
  const machineActor = loadMachineActorOrRedirect(context.session, request, tabId, { stateName: 'parent-info' });

  const formData = await request.formData();
  const action = formData.get('action');

  switch (action) {
    case 'back': {
      machineActor.send({ type: 'prev' });
      break;
    }

    case 'next': {
      const parentAmount = Number(formData.get('parent-amount')) || 0;
      const inputLength = Math.min(parentAmount, maxNumberOfParents);

      const parseResult = v.safeParse(
        parentDetailsSchema,
        Array.from({ length: inputLength }).map((_, i) => ({
          unavailable: Boolean(formData.get(`${i}-unavailable`)),
          givenName: String(formData.get(`${i}-given-name`)),
          lastName: String(formData.get(`${i}-last-name`)),
          birthLocation: {
            country: String(formData.get(`${i}-country`)),
            province: trimToUndefined(String(formData.get(`${i}-province`))),
            city: trimToUndefined(String(formData.get(`${i}-city`))),
          },
        })),
      );

      if (!parseResult.success) {
        return data(
          { errors: v.flatten<typeof parentDetailsSchema>(parseResult.issues).nested },
          { status: HttpStatusCodes.BAD_REQUEST },
        );
      }

      machineActor.send({ type: 'submitParentDetails', data: parseResult.output });
      break;
    }

    default: {
      throw new AppError(`Unrecognized action: ${action}`, ErrorCodes.UNRECOGNIZED_ACTION);
    }
  }

  throw redirect(getStateRoute(machineActor, { context, params, request }));
}

export async function loader({ context, request }: Route.LoaderArgs) {
  requireAllRoles(context.session, new URL(request.url), ['user']);

  const tabId = getTabIdOrRedirect(request);
  const machineActor = loadMachineActorOrRedirect(context.session, request, tabId, { stateName: 'parent-info' });
  const { parentDetails = [] } = machineActor.getSnapshot().context;

  const { lang, t } = await getTranslation(request, handle.i18nNamespace);

  return {
    documentTitle: t('protected:parent-details.page-title'),
    localizedCountries: getLocalizedCountries(lang),
    localizedProvincesTerritoriesStates: getLocalizedProvinces(lang),
    maxParents: maxNumberOfParents,
    defaultFormValues: parentDetails,
  };
}

export default function CreateRequest({ loaderData, actionData, params }: Route.ComponentProps) {
  const { t } = useTranslation(handle.i18nNamespace);

  const fetcherKey = useId();
  const fetcher = useFetcher<Info['actionData']>({ key: fetcherKey });
  const fetcherState = useFetcherState(fetcher);
  const errors = fetcher.data?.errors;

  return (
    <>
      <PageTitle subTitle={t('protected:in-person.title')}>{t('protected:parent-details.page-title')}</PageTitle>
      <div className="max-w-prose">
        <FetcherErrorSummary fetcherKey={fetcherKey}>
          <fetcher.Form method="post" noValidate>
            <ParentInformation errors={errors} loaderData={loaderData} />
            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton
                name="action"
                value="next"
                variant="primary"
                id="continue-button"
                disabled={fetcherState.submitting}
                loading={fetcherState.submitting && fetcherState.action === 'next'}
              >
                {t('protected:person-case.next')}
              </LoadingButton>
              <Button name="action" value="back" id="back-button" disabled={fetcherState.submitting}>
                {t('protected:person-case.previous')}
              </Button>
            </div>
          </fetcher.Form>
        </FetcherErrorSummary>
      </div>
    </>
  );
}

interface ParentInformationProps {
  loaderData: Route.ComponentProps['loaderData'];
  errors?: Record<string, [string, ...string[]] | undefined>;
}

function ParentInformation({ loaderData, errors }: ParentInformationProps) {
  const { t } = useTranslation(handle.i18nNamespace);
  const { idList, addId, removeId } = useIdList(Math.max(loaderData.defaultFormValues.length, 1));

  const canAddParent = idList.length < loaderData.maxParents;

  function onAddParent() {
    if (canAddParent) addId();
  }

  function onRemoveParent(index: number) {
    // remove parent data from the form values
    loaderData.defaultFormValues.splice(index, 1);
    removeId(index);
  }

  return (
    <>
      <input type="hidden" name="parent-amount" value={idList.length} />
      <div className="space-y-10">
        {idList.map((id, index) => (
          <ParentForm
            key={id}
            index={index}
            loaderData={loaderData}
            errors={errors}
            onRemove={idList.length > 1 ? onRemoveParent : undefined}
          />
        ))}
      </div>
      {canAddParent && (
        <Button size="lg" type="button" variant="link" endIcon={faPlus} className="mt-3 px-3" onClick={onAddParent}>
          {t('protected:parent-details.add-parent')}
        </Button>
      )}
    </>
  );
}

interface ParentFormProps {
  index: number;
  loaderData: Route.ComponentProps['loaderData'];
  errors?: Record<string, [string, ...string[]] | undefined>;
  onRemove?: (index: number) => void;
}

function ParentForm({ index, loaderData, errors, onRemove }: ParentFormProps) {
  const { t } = useTranslation(handle.i18nNamespace);
  const defaultValues = loaderData.defaultFormValues.at(index);

  const [unavailable, setUnavailable] = useState(defaultValues?.unavailable);
  const [country, setCountry] = useState(defaultValues?.birthLocation?.country);

  const countryOptions = [{ id: 'select-option', name: '' }, ...loaderData.localizedCountries].map(({ id, name }) => ({
    value: id === 'select-option' ? '' : id,
    children: id === 'select-option' ? t('protected:person-case.select-option') : name,
  }));

  const provinceOptions = [{ id: 'select-option', name: '' }, ...loaderData.localizedProvincesTerritoriesStates].map(
    ({ id, name }) => ({
      value: id === 'select-option' ? '' : id,
      children: id === 'select-option' ? t('protected:person-case.select-option') : name,
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex w-full items-center justify-between sm:w-150">
        <h2 className="font-lato text-2xl font-bold">
          {t('protected:parent-details.section-title')}
          <span className="ml-[0.5ch]">{index + 1}</span>
        </h2>
        {onRemove && (
          <Button size="lg" type="button" variant="link" endIcon={faXmark} className="px-3" onClick={() => onRemove(index)}>
            {t('protected:parent-details.remove')}
          </Button>
        )}
      </div>
      <InputCheckbox
        errorMessage={t(extractValidationKey(errors?.[`${index}.unavailable`]))}
        id={`${index}-unavailable-id`}
        name={`${index}-unavailable`}
        defaultChecked={unavailable ?? false}
        required
        onChange={({ target }) => setUnavailable(target.checked)}
      >
        {t('protected:parent-details.details-unavailable')}
      </InputCheckbox>
      {!unavailable && (
        <>
          <InputField
            errorMessage={t(extractValidationKey(errors?.[`${index}.givenName`]))}
            label={t('protected:parent-details.given-name')}
            name={`${index}-given-name`}
            defaultValue={defaultValues?.givenName ?? ''}
            required
            type="text"
            className="w-full"
          />
          <InputField
            errorMessage={t(extractValidationKey(errors?.[`${index}.lastName`]))}
            label={t('protected:parent-details.last-name')}
            name={`${index}-last-name`}
            defaultValue={defaultValues?.lastName ?? ''}
            required
            type="text"
            className="w-full"
          />
          <InputSelect
            errorMessage={t(extractValidationKey(errors?.[`${index}.birthLocation.country`]))}
            className="w-full sm:w-1/2"
            id={`${index}-country-id`}
            name={`${index}-country`}
            label={t('protected:parent-details.country')}
            defaultValue={defaultValues?.birthLocation?.country ?? ''}
            options={countryOptions}
            onChange={({ target }) => setCountry(target.value)}
          />
          {country === globalThis.__appEnvironment.PP_CANADA_COUNTRY_CODE ? (
            <InputSelect
              errorMessage={t(extractValidationKey(errors?.[`${index}.birthLocation.province`]))}
              className="w-full sm:w-1/2"
              id={`${index}-province-id`}
              name={`${index}-province`}
              label={t('protected:parent-details.province')}
              defaultValue={defaultValues?.birthLocation?.province ?? ''}
              options={provinceOptions}
            />
          ) : (
            <InputField
              errorMessage={t(extractValidationKey(errors?.[`${index}.birthLocation.province`]))}
              className="w-full"
              label={t('protected:parent-details.province')}
              name={`${index}-province`}
              defaultValue={defaultValues?.birthLocation?.province ?? ''}
              type="text"
            />
          )}
          <InputField
            errorMessage={t(extractValidationKey(errors?.[`${index}.birthLocation.city`]))}
            className="w-full"
            label={t('protected:parent-details.city')}
            name={`${index}-city`}
            defaultValue={defaultValues?.birthLocation?.city ?? ''}
            type="text"
          />
        </>
      )}
    </div>
  );
}

/**
 * A custom hook that manages a collection of unique numeric IDs.
 *
 * Useful for dynamically adding/removing form elements or list items with stable identifiers.
 *
 * @param initialSize - The initial number of IDs to generate in the collection. Must be a non-negative integer.
 *
 * @returns An object containing:
 *   - idList: An array of unique numeric IDs
 *   - addId: Function that appends a new unique ID to the list
 *   - removeId: Function that removes an ID at the specified index
 */
function useIdList(initialSize: number) {
  const [idList, setIdList] = useState(Array.from({ length: initialSize }, (_, index) => index + 1));

  return {
    /**
     * The list of current ids
     */
    idList: idList,

    /**
     * Adds a new id to the id list
     */
    addId: () => {
      setIdList((prev) => {
        const nextId = (prev[prev.length - 1] ?? 0) + 1;
        return [...prev, nextId];
      });
    },

    /**
     * Removes an id at the specified index.
     *
     * @param index - The index of the id to remove.
     */
    removeId: (index: number) => {
      if (index < idList.length) {
        setIdList((prev) => prev.filter((_, i) => i !== index));
      }
    },
  };
}
