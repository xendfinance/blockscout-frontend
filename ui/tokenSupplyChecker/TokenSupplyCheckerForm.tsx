import { Button, Grid, Text, chakra, HStack, Box, VStack, Divider, Radio, RadioGroup, Stack } from '@chakra-ui/react';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm, FormProvider } from 'react-hook-form';
import { parseAbi, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';

import type { FormFieldsBalanceChecker } from 'ui/contractVerification/types';

import useToast from 'lib/hooks/useToast';
import ContractVerificationFormRow from 'ui/contractVerification/ContractVerificationFormRow';
import FormFieldText from 'ui/shared/forms/fields/FormFieldText';

// ERC20 ABI for totalSupply function
const erc20Abi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]);

interface SupplyResult {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: string;
  decimals: number;
  formattedSupply: string;
  blockNumber: string;
  message?: string;
}

// Utility function to check if contract exists at specific block
const isContractDeployedAtBlock = async(
  contractAddress: `0x${ string }`,
  blockNumber: bigint,
  publicClient: PublicClient,
) => {
  try {
    const code = await publicClient.getBytecode({
      address: contractAddress,
      blockNumber,
    });
    return code && code !== '0x';
  } catch {
    return false;
  }
};

// Binary search to find block number from timestamp
const findBlockByTimestamp = async(targetTimestamp: number, publicClient: PublicClient) => {
  let low = BigInt(0);
  let high = await publicClient.getBlockNumber();
  const targetTimestampBigInt = BigInt(targetTimestamp);

  while (low <= high) {
    const mid = (low + high) / BigInt(2);
    const block = await publicClient.getBlock({ blockNumber: mid });

    if (block.timestamp === targetTimestampBigInt) return mid;
    if (block.timestamp < targetTimestampBigInt) low = mid + BigInt(1);
    else high = mid - BigInt(1);
  }
  return low; // Return closest block
};

const TokenSupplyCheckerForm = () => {
  const formApi = useForm<FormFieldsBalanceChecker>({
    mode: 'onBlur',
    defaultValues: {
      address: '',
      method: { label: '', value: 'flattened-code' },
      license_type: null,
      cryptocurrency: { label: 'ERC20', value: 'ERC20' },
      account_address: '',
      filter_type: 'date',
      date_snapshot: '',
      block_number: '',
      erc20_address: '',
    },
  });

  const { handleSubmit, watch, formState, setError, reset, clearErrors, setValue } = formApi;
  const toast = useToast();
  const publicClient = usePublicClient();

  // State for supply results
  const [ supplyResult, setSupplyResult ] = React.useState<SupplyResult | null>(null);
  const [ isLoading, setIsLoading ] = React.useState(false);

  const onFormSubmit: SubmitHandler<FormFieldsBalanceChecker> = React.useCallback(async(data) => {
    // Validate required fields
    if (!data.erc20_address) {
      setError('erc20_address', { message: 'Please enter a token contract address' });
      return;
    }

    if (data.filter_type === 'date' && !data.date_snapshot) {
      setError('date_snapshot', { message: 'Please select a date' });
      return;
    }

    if (data.filter_type === 'block' && !data.block_number) {
      setError('block_number', { message: 'Please enter a block number' });
      return;
    }

    if (!publicClient) {
      toast({
        position: 'top-right',
        title: 'Error',
        description: 'Public client not available',
        status: 'error',
        variant: 'subtle',
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setSupplyResult(null);

    try {
      const tokenAddress = data.erc20_address as `0x${ string }`;

      let blockNumber: bigint;

      // Convert timestamp to block number if using date filter
      if (data.filter_type === 'date') {
        const timestamp = Math.floor(new Date(data.date_snapshot).getTime() / 1000);
        blockNumber = await findBlockByTimestamp(timestamp, publicClient);
      } else {
        blockNumber = BigInt(data.block_number);
      }

      // Check if contract exists at this block
      const isDeployed = await isContractDeployedAtBlock(tokenAddress, blockNumber, publicClient);

      if (!isDeployed) {
        setSupplyResult({
          tokenAddress: data.erc20_address,
          tokenSymbol: 'Unknown',
          tokenName: 'Unknown',
          totalSupply: '0',
          decimals: 18,
          formattedSupply: '0.000000',
          blockNumber: blockNumber.toString(),
          message: 'Token not deployed at this block number',
        });

        toast({
          position: 'top-right',
          title: 'Token Not Deployed',
          description: `The token was not deployed at block ${ blockNumber.toString() }. Supply is 0.`,
          status: 'info',
          variant: 'subtle',
          isClosable: true,
        });
        return;
      }

      // Get token supply info
      const [ totalSupply, decimals, symbol, name ] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'totalSupply',
          blockNumber,
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'decimals',
          blockNumber,
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'symbol',
          blockNumber,
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'name',
          blockNumber,
        }),
      ]);

      setSupplyResult({
        tokenAddress: data.erc20_address,
        tokenSymbol: symbol,
        tokenName: name,
        totalSupply: totalSupply.toString(),
        decimals: Number(decimals),
        formattedSupply: (Number(totalSupply) / 10 ** Number(decimals)).toFixed(6),
        blockNumber: blockNumber.toString(),
      });

      toast({
        position: 'top-right',
        title: 'Supply Retrieved',
        description: `Successfully retrieved supply for ${ data.erc20_address }`,
        status: 'success',
        variant: 'subtle',
        isClosable: true,
      });
    } catch (error) {
      toast({
        position: 'top-right',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to lookup supply',
        status: 'error',
        variant: 'subtle',
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [ setError, toast, publicClient ]);

  const handleFormChange = React.useCallback(() => {
    clearErrors('root');
  }, [ clearErrors ]);

  const handleReset = React.useCallback(() => {
    reset();
    setSupplyResult(null);
  }, [ reset ]);

  const filterType = watch('filter_type');

  // Update form when filter type changes
  React.useEffect(() => {
    if (filterType === 'date') {
      setValue('block_number', '');
    } else {
      setValue('date_snapshot', '');
    }
  }, [ filterType, setValue ]);

  const handleFilterTypeChange = React.useCallback((value: 'date' | 'block') => {
    setValue('filter_type', value);
  }, [ setValue ]);

  return (
    <FormProvider { ...formApi }>
      <chakra.form
        noValidate
        onSubmit={ handleSubmit(onFormSubmit) }
        onChange={ handleFormChange }
      >
        <Grid
          as="section"
          columnGap="30px"
          rowGap={{ base: 2, lg: 5 }}
          templateColumns={{ base: '1fr', lg: 'minmax(auto, 680px) minmax(0, 340px)' }}
        >
          <ContractVerificationFormRow>
            <FormFieldText<FormFieldsBalanceChecker, 'erc20_address'>
              name="erc20_address"
              isRequired
              placeholder="0x..."
              type="text"
            />

            <span>
              Enter the ERC20 token contract address for which you want to check the historical supply.
            </span>
          </ContractVerificationFormRow>

          <ContractVerificationFormRow>
            <Box>
              <Text mb={ 3 } fontWeight="medium">Filter by:</Text>
              <RadioGroup
                value={ filterType }
                onChange={ handleFilterTypeChange }
              >
                <Stack direction="row" spacing={ 6 }>
                  <Radio value="date">Date</Radio>
                  <Radio value="block">Block Number</Radio>
                </Stack>
              </RadioGroup>
            </Box>

            <span>
              Choose whether to filter the supply lookup by a specific date or block number.
            </span>
          </ContractVerificationFormRow>

          { filterType === 'date' && (
            <ContractVerificationFormRow>
              <FormFieldText<FormFieldsBalanceChecker, 'date_snapshot'>
                name="date_snapshot"
                isRequired
                placeholder="MM/DD/YYYY"
                type="date"
              />

              <span>
                Select the date for the supply snapshot.
              </span>
            </ContractVerificationFormRow>
          ) }

          { filterType === 'block' && (
            <ContractVerificationFormRow>
              <FormFieldText<FormFieldsBalanceChecker, 'block_number'>
                name="block_number"
                isRequired
                placeholder="Enter block number"
                type="number"
              />

              <span>
                Enter the specific block number for the supply snapshot.
              </span>
            </ContractVerificationFormRow>
          ) }

          { /* Display form validation errors */ }
          { formState.errors.root?.message && (
            <ContractVerificationFormRow>
              <Text color="red.500" fontSize="sm">
                { formState.errors.root.message }
              </Text>
            </ContractVerificationFormRow>
          ) }
        </Grid>

        <HStack spacing={ 4 } mt={ 12 }>
          <Button
            variant="solid"
            size="lg"
            type="submit"
            isLoading={ isLoading }
            loadingText="Looking up..."
            isDisabled={ !watch('erc20_address') }
          >
            Lookup
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={ handleReset }
            isDisabled={ isLoading }
          >
            Reset
          </Button>
        </HStack>

        { /* Display supply results */ }
        { supplyResult && (
          <VStack spacing={ 4 } mt={ 8 } p={ 6 } borderRadius="md" align="stretch">
            <Text fontSize="lg" fontWeight="bold">Total Supply for Contract Address: { supplyResult.tokenAddress }</Text>
            <Divider/>
            { supplyResult.message && (
              <Box p={ 3 } bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                <Text color="blue.800" fontSize="sm" fontWeight="medium">
                  { supplyResult.message }
                </Text>
              </Box>
            ) }
            <Grid templateColumns="1fr 1fr 1fr" gap={ 4 }>
              <Box>
                <Text fontWeight="medium" color="gray.600">SNAPSHOT DATE:</Text>
                <Text>{ filterType === 'date' ? watch('date_snapshot') : 'N/A' }</Text>
              </Box>
              <Box>
                <Text fontWeight="medium" color="gray.600">BLOCK:</Text>
                <Text color="blue.500">{ supplyResult.blockNumber }</Text>
              </Box>
              <Box>
                <Text fontWeight="medium" color="gray.600">TOKEN QUANTITY:</Text>
                <Text fontSize="lg" fontWeight="bold">{ supplyResult.formattedSupply } { supplyResult.tokenSymbol }</Text>
              </Box>
            </Grid>
          </VStack>
        ) }
      </chakra.form>
    </FormProvider>
  );
};

export default React.memo(TokenSupplyCheckerForm);
