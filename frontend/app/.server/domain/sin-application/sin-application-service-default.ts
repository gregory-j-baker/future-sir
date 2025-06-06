import { setSinCases } from '~/.server/domain/multi-channel/sin-cases-store';
import {
  mapSinApplicationResponseToSubmitSinApplicationResponse,
  mapSubmitSinApplicationRequestToSinApplicationRequest,
} from '~/.server/domain/sin-application/sin-application-mappers';
import type {
  SubmitSinApplicationRequest,
  SubmitSinApplicationResponse,
} from '~/.server/domain/sin-application/sin-application-models';
import type { SinApplicationService } from '~/.server/domain/sin-application/sin-application-service';
import { LogFactory } from '~/.server/logging';
import { interopClient } from '~/.server/shared/api/interop-client';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const log = LogFactory.getLogger(import.meta.url);

export function getDefaultSinApplicationService(): SinApplicationService {
  return {
    submitSinApplication: async (
      submitSinApplicationRequest: SubmitSinApplicationRequest,
      idToken: string,
    ): Promise<SubmitSinApplicationResponse> => {
      log.debug('Submitting SIN application request.');
      log.trace('Submitting SIN application with request:', submitSinApplicationRequest);

      const body = mapSubmitSinApplicationRequestToSinApplicationRequest(submitSinApplicationRequest, idToken);

      log.trace(
        'Submitting SIN application payload:',
        mapSubmitSinApplicationRequestToSinApplicationRequest(submitSinApplicationRequest, idToken),
      );

      const { response, data, error } = await interopClient.POST('/SINApplication', { body });

      if (data === undefined) {
        const content = JSON.stringify(error);
        log.error('Failed to submit SIN application; status: %s; content: %s', response.status, content);
        throw new AppError(
          `Failed to submit SIN application; status: ${response.status}; content: ${content}`,
          ErrorCodes.SUBMIT_SIN_APPLICATION_FAILED,
        );
      }

      const submitSinApplicationResponse = mapSinApplicationResponseToSubmitSinApplicationResponse(data);

      // TODO ::: GjB ::: maybe remove after demo?
      void setSinCases({ ...submitSinApplicationRequest, caseId: submitSinApplicationResponse.identificationId });

      log.debug('SIN application submitted successfully with response: %s', submitSinApplicationResponse);
      return submitSinApplicationResponse;
    },
  };
}
