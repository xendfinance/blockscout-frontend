import React from 'react';

import useFormConfigQuery from 'ui/contractVerification/useFormConfigQuery';
import ContentLoader from 'ui/shared/ContentLoader';
import DataFetchAlert from 'ui/shared/DataFetchAlert';
import PageTitle from 'ui/shared/Page/PageTitle';
import TokenSupplyCheckerForm from 'ui/tokenSupplyChecker/TokenSupplyCheckerForm';

const TokenSupplyChecker = () => {
  const configQuery = useFormConfigQuery(true);

  const content = (() => {
    if (configQuery.isError) {
      return <DataFetchAlert/>;
    }

    if (configQuery.isPending) {
      return <ContentLoader/>;
    }

    return (
      <TokenSupplyCheckerForm/>
    );
  })();

  return (
    <>
      <PageTitle title="Token Supply Checker"/>
      { content }
    </>
  );
};

export default TokenSupplyChecker;
