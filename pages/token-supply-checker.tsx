import type { NextPage } from 'next';
import React from 'react';

import type { Props } from 'nextjs/getServerSideProps';
import PageNextJs from 'nextjs/PageNextJs';

import TokenSupplyChecker from 'ui/pages/TokenSupplyChecker';

const Page: NextPage<Props> = (props: Props) => {
  return (
    <PageNextJs pathname="/token-supply-checker" query={ props.query }>
      <TokenSupplyChecker/>
    </PageNextJs>
  );
};

export default Page;

export { base as getServerSideProps } from 'nextjs/getServerSideProps';
