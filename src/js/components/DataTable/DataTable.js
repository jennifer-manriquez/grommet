import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from 'react';
import { ThemeContext } from 'styled-components';

import { defaultProps } from '../../default-props';

import { useLayoutEffect } from '../../utils/use-isomorphic-layout-effect';
import { Box } from '../Box';
import { Text } from '../Text';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { Header } from './Header';
import { Footer } from './Footer';
import { Body } from './Body';
import { GroupedBody } from './GroupedBody';
import { Pagination } from '../Pagination';
import {
  buildFooterValues,
  buildGroups,
  buildGroupState,
  filterAndSortData,
  initializeFilters,
  normalizeCellProps,
  normalizePrimaryProperty,
} from './buildState';
import { normalizeShow, usePagination } from '../../utils';
import {
  StyledContainer,
  StyledDataTable,
  StyledPlaceholder,
} from './StyledDataTable';

function useGroupState(groups, groupBy) {
  const [groupState, setGroupState] = useState(() =>
    buildGroupState(groups, groupBy),
  );
  const [prevDeps, setPrevDeps] = useState({ groups, groupBy });

  const { groups: prevGroups, groupBy: prevGroupBy } = prevDeps;
  if (groups !== prevGroups || groupBy !== prevGroupBy) {
    setPrevDeps({ groups, groupBy });
    const nextGroupState = buildGroupState(groups, groupBy);
    setGroupState(nextGroupState);
    return [nextGroupState, setGroupState];
  }

  return [groupState, setGroupState];
}

const DataTable = ({
  background,
  border,
  columns = [],
  data = [],
  fill,
  groupBy,
  onClickRow, // removing unknown DOM attributes
  onMore,
  moreButton = false,
  onSearch, // removing unknown DOM attributes
  onSelect,
  onSort: onSortProp,
  replace,
  pad,
  paginate,
  pin,
  placeholder,
  primaryKey,
  resizeable,
  rowProps,
  select,
  show: showProp,
  size,
  sort: sortProp,
  sortable,
  rowDetails,
  step = 50,
  ...rest
}) => {
  const theme = useContext(ThemeContext) || defaultProps.theme;

  // property name of the primary property
  const primaryProperty = useMemo(
    () => normalizePrimaryProperty(columns, primaryKey),
    [columns, primaryKey],
  );

  // whether or not we should show a footer
  const showFooter = useMemo(
    () => columns.filter((c) => c.footer).length > 0,
    [columns],
  );

  // what column we are actively capturing filter input on
  const [filtering, setFiltering] = useState();

  // the currently active filters
  const [filters, setFilters] = useState(initializeFilters(columns));

  // which column we are sorting on, with direction
  const [sort, setSort] = useState(sortProp || {});

  // the data filtered and sorted, if needed
  const adjustedData = useMemo(
    () => filterAndSortData(data, filters, onSearch, sort),
    [data, filters, onSearch, sort],
  );

  // the values to put in the footer cells
  const footerValues = useMemo(
    () => buildFooterValues(columns, adjustedData),
    [adjustedData, columns],
  );

  // cell styling properties: background, border, pad
  const cellProps = useMemo(
    () => normalizeCellProps({ background, border, pad, pin }, theme),
    [background, border, pad, pin, theme],
  );

  // if groupBy, an array with one item per unique groupBy key value
  const groups = useMemo(
    () => buildGroups(columns, adjustedData, groupBy),
    [adjustedData, columns, groupBy],
  );

  // an object indicating which group values are expanded
  const [groupState, setGroupState] = useGroupState(groups, groupBy);

  const [selected, setSelected] = useState(
    select || (onSelect && []) || undefined,
  );
  useEffect(
    () => setSelected(select || (onSelect && []) || undefined),
    [onSelect, select],
  );

  const [rowExpand, setRowExpand] = useState([]);

  // any customized column widths
  const [widths, setWidths] = useState({});

  // placeholder placement stuff
  const headerRef = useRef();
  const bodyRef = useRef();
  const footerRef = useRef();
  const [headerHeight, setHeaderHeight] = useState();
  const [footerHeight, setFooterHeight] = useState();

  // offset compensation when body overflows
  const [scrollOffset, setScrollOffset] = useState(0);

  // multiple pinned columns offset
  const [pinnedOffset, setPinnedOffset] = useState();

  const onHeaderWidths = useCallback(
    (columnWidths) => {
      const pinnedProperties = columns
        .map((pinnedColumn) => pinnedColumn.pin && pinnedColumn.property)
        .filter((n) => n);

      const nextPinnedOffset = {};

      if (columnWidths !== []) {
        pinnedProperties.forEach((property, index) => {
          const hasSelectColumn = Boolean(select || onSelect);

          const columnIndex =
            columns.findIndex((column) => column.property === property) +
            hasSelectColumn;

          if (columnWidths[columnIndex]) {
            nextPinnedOffset[property] = {
              width: columnWidths[columnIndex],
              left:
                index === 0
                  ? 0
                  : nextPinnedOffset[pinnedProperties[index - 1]].left +
                    nextPinnedOffset[pinnedProperties[index - 1]].width,
            };
          }
        });

        setPinnedOffset(nextPinnedOffset);
      }
    },
    [columns, setPinnedOffset, select, onSelect],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const nextScrollOffset =
      bodyRef.current.parentElement?.clientWidth - bodyRef.current.clientWidth;
    if (nextScrollOffset !== scrollOffset) setScrollOffset(nextScrollOffset);
  });

  useLayoutEffect(() => {
    if (placeholder) {
      if (headerRef.current) {
        const nextHeaderHeight =
          headerRef.current.getBoundingClientRect().height;
        setHeaderHeight(nextHeaderHeight);
      } else setHeaderHeight(0);
      if (footerRef.current) {
        const nextFooterHeight =
          footerRef.current.getBoundingClientRect().height;
        setFooterHeight(nextFooterHeight);
      } else setFooterHeight(0);
    }
  }, [footerRef, headerRef, placeholder]);

  // remember that we are filtering on this property
  const onFiltering = (property) => setFiltering(property);

  // remember the search text we should filter this property by
  const onFilter = (property, value) => {
    const nextFilters = { ...filters };
    nextFilters[property] = value;
    setFilters(nextFilters);
    // Let caller know about search, if interested
    if (onSearch) onSearch(nextFilters);
  };

  // toggle the sort direction on this property
  const onSort = (property) => () => {
    const external = sort ? sort.external : false;
    let direction;
    if (!sort || property !== sort.property) direction = 'asc';
    else if (sort.direction === 'asc') direction = 'desc';
    else direction = 'asc';
    const nextSort = { property, direction, external };
    setSort(nextSort);
    if (onSortProp) onSortProp(nextSort);
  };

  // toggle whether the group is expanded
  const onToggleGroup = (groupValue) => () => {
    const nextGroupState = { ...groupState };
    nextGroupState[groupValue] = {
      ...nextGroupState[groupValue],
      expanded: !nextGroupState[groupValue].expanded,
    };
    setGroupState(nextGroupState);
    if (groupBy.onExpand) {
      const expandedKeys = Object.keys(nextGroupState).filter(
        (k) => nextGroupState[k].expanded,
      );
      groupBy.onExpand(expandedKeys);
    }
  };

  // toggle whether all groups are expanded
  const onToggleGroups = () => {
    const expanded =
      Object.keys(groupState).filter((k) => !groupState[k].expanded).length ===
      0;
    const nextGroupState = {};
    Object.keys(groupState).forEach((k) => {
      nextGroupState[k] = { ...groupState[k], expanded: !expanded };
    });
    setGroupState(nextGroupState);
    if (groupBy.onExpand) {
      const expandedKeys = Object.keys(nextGroupState).filter(
        (k) => nextGroupState[k].expanded,
      );
      groupBy.onExpand(expandedKeys);
    }
  };

  // remember the width this property's column should be
  const onResize = useCallback(
    (property, width) => {
      if (widths[property] !== width) {
        const nextWidths = { ...widths };
        nextWidths[property] = width;
        setWidths(nextWidths);
      }
    },
    [widths],
  );

  if (size && resizeable) {
    console.warn('DataTable cannot combine "size" and "resizeble".');
  }

  const [items, paginationProps] = usePagination({
    data: adjustedData,
    page: normalizeShow(showProp, step),
    step,
    ...paginate, // let any specifications from paginate prop override component
  });

  const Container = paginate ? StyledContainer : Fragment;
  const containterProps = paginate
    ? { ...theme.dataTable.container, fill }
    : undefined;

  // DataTable should overflow if paginating but pagination component
  // should remain in its location
  const OverflowContainer = paginate ? Box : Fragment;
  const overflowContainerProps = paginate
    ? { overflow: { horizontal: 'auto' }, flex: false }
    : undefined;

  // necessary for Firefox, otherwise paginated DataTable will
  // not fill its container like it does by default on other
  // browsers like Chrome/Safari
  const paginatedDataTableProps =
    paginate && (fill === true || fill === 'horizontal')
      ? { style: { minWidth: '100%' } }
      : undefined;

  // Choose what to display: button to load more , spinner, or
  // unretrieved message in case the function takes long to get data
  const [moreButtonState, setMoreButtonState] = useState('button');

  const moreButtonRef = useRef(moreButtonState);
  moreButtonRef.current = moreButtonState;

  // If 10 seconds pass without getting data change moreButtonState
  // to let user know and ask to load more again
  const dataTimeout = () => {
    setTimeout(() => {
      if (moreButtonRef.current === 'spinner') {
        setMoreButtonState('unretrieved');
      }
    }, 10000);
  };

  useEffect(() => {
    if (moreButtonState === 'spinner') {
      onMore();
      dataTimeout();
    }
  }, [moreButtonState]);

  // When data is retrieved set moreButton again
  useEffect(() => {
    setMoreButtonState('button');
  }, [data.length]);

  if (moreButton === true && !onMore) {
    console.warn(
      'You need to provide an function in the onMore field to use moreButton',
    );
  }

  const memoizedmoreButtonState = useMemo(() => {
    if (moreButton && moreButtonState === 'button') {
      return (
        <Button
          label="load more"
          onClick={() => setMoreButtonState('spinner')}
        />
      );
    }
    if (moreButton && moreButtonState === 'spinner') {
      return (
        <Box gap="small" direction="row">
          <Spinner />
          <Text>Loading...</Text>
        </Box>
      );
    }
    if (moreButton && moreButtonState === 'unretrieved') {
      return (
        <>
          <Text> Retrieving data is taking too long. Try again.</Text>
          <Button
            label="load more"
            margin="small"
            display="block"
            onClick={() => setMoreButtonState('spinner')}
          />
        </>
      );
    }
    return null;
  }, [moreButtonState, moreButton, setMoreButtonState]);

  return (
    <Container {...containterProps}>
      <OverflowContainer {...overflowContainerProps}>
        <StyledDataTable
          fillProp={!paginate ? fill : undefined}
          {...paginatedDataTableProps}
          {...rest}
        >
          <Header
            ref={headerRef}
            cellProps={cellProps.header}
            columns={columns}
            data={adjustedData}
            fill={fill}
            filtering={filtering}
            filters={filters}
            groups={groups}
            groupState={groupState}
            pin={pin === true || pin === 'header'}
            pinnedOffset={pinnedOffset}
            selected={selected}
            size={size}
            sort={sort}
            widths={widths}
            onFiltering={onFiltering}
            onFilter={onFilter}
            onResize={resizeable ? onResize : undefined}
            onSelect={
              onSelect
                ? (nextSelected) => {
                    setSelected(nextSelected);
                    if (onSelect) onSelect(nextSelected);
                  }
                : undefined
            }
            onSort={sortable || sortProp || onSortProp ? onSort : undefined}
            onToggle={onToggleGroups}
            onWidths={onHeaderWidths}
            primaryProperty={primaryProperty}
            scrollOffset={scrollOffset}
            rowDetails={rowDetails}
          />
          {groups ? (
            <GroupedBody
              ref={bodyRef}
              cellProps={cellProps.body}
              columns={columns}
              groupBy={groupBy.property ? groupBy.property : groupBy}
              groups={groups}
              groupState={groupState}
              pinnedOffset={pinnedOffset}
              primaryProperty={primaryProperty}
              onSelect={
                onSelect
                  ? (nextSelected) => {
                      setSelected(nextSelected);
                      if (onSelect) onSelect(nextSelected);
                    }
                  : undefined
              }
              onToggle={onToggleGroup}
              rowProps={rowProps}
              selected={selected}
              size={size}
            />
          ) : (
            <Body
              ref={bodyRef}
              cellProps={cellProps.body}
              columns={columns}
              data={!paginate ? adjustedData : items}
              onMore={onMore}
              moreButton={moreButton}
              replace={replace}
              onClickRow={onClickRow}
              onSelect={
                onSelect
                  ? (nextSelected) => {
                      setSelected(nextSelected);
                      if (onSelect) onSelect(nextSelected);
                    }
                  : undefined
              }
              pinnedCellProps={cellProps.pinned}
              pinnedOffset={pinnedOffset}
              placeholder={placeholder}
              primaryProperty={primaryProperty}
              rowProps={rowProps}
              selected={selected}
              show={!paginate ? showProp : undefined}
              size={size}
              step={step}
              rowDetails={rowDetails}
              rowExpand={rowExpand}
              setRowExpand={setRowExpand}
            />
          )}
          {showFooter && (
            <Footer
              ref={footerRef}
              cellProps={cellProps.footer}
              columns={columns}
              fill={fill}
              footerValues={footerValues}
              groups={groups}
              onSelect={onSelect}
              pin={pin === true || pin === 'footer'}
              pinnedOffset={pinnedOffset}
              primaryProperty={primaryProperty}
              scrollOffset={scrollOffset}
              selected={selected}
              size={size}
            />
          )}
          {placeholder && (
            <StyledPlaceholder top={headerHeight} bottom={footerHeight}>
              {typeof placeholder === 'string' ? (
                <Box
                  background={{ color: 'background-front', opacity: 'strong' }}
                  align="center"
                  justify="center"
                  fill="vertical"
                >
                  <Text>{placeholder}</Text>
                </Box>
              ) : (
                placeholder
              )}
            </StyledPlaceholder>
          )}
        </StyledDataTable>
      </OverflowContainer>
      {paginate && data.length > step && items && items.length ? (
        <Pagination alignSelf="end" {...paginationProps} />
      ) : null}
      {onMore && moreButton ? (
        <Box align="center" pad="small">
          {memoizedmoreButtonState}
        </Box>
      ) : null}
    </Container>
  );
};

let DataTableDoc;
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line global-require
  DataTableDoc = require('./doc').doc(DataTable);
}
const DataTableWrapper = DataTableDoc || DataTable;

export { DataTableWrapper as DataTable };
