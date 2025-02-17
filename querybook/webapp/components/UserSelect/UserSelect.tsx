import React from 'react';
import AsyncSelect, { Props as AsyncProps } from 'react-select/lib/Async';
import { debounce } from 'lodash';

import ds from 'lib/datasource';
import { makeReactSelectStyle } from 'lib/utils/react-select';
import { overlayRoot } from 'ui/Overlay/Overlay';
import { IUserInfo } from 'redux/user/types';
import { UserAvatar } from 'components/UserBadge/UserAvatar';

interface IUserSearchResultRow {
    id: number;
    username: string;
    fullname: string;
}

const loadOptions = debounce(
    (name, callback) => {
        ds.fetch('/search/user/', { name }).then(
            ({ data }: { data: IUserSearchResultRow[] }) => {
                callback(
                    data.map((user) => ({
                        value: user.id,
                        label: <UserSelectOptionRow user={user} />,
                    }))
                );
            }
        );
    },
    1000,
    {
        leading: true,
    }
);

interface IUserSelectProps {
    onSelect: (uid: number, name: string) => any;
    usePortalMenu?: boolean;

    selectProps?: Partial<AsyncProps<any>>;

    // remove the selected user name after select
    clearAfterSelect?: boolean;
}

export const UserSelect: React.FunctionComponent<IUserSelectProps> = ({
    onSelect,
    usePortalMenu = true,
    selectProps = {},
    clearAfterSelect = false,
}) => {
    const [searchText, setSearchText] = React.useState('');
    const asyncSelectProps: Partial<AsyncProps<any>> = {};
    const userReactSelectStyle = makeReactSelectStyle(usePortalMenu);
    if (usePortalMenu) {
        asyncSelectProps.menuPortalTarget = overlayRoot;
    }
    if (clearAfterSelect) {
        asyncSelectProps.value = null;
    }

    return (
        <AsyncSelect
            styles={userReactSelectStyle}
            placeholder={'username...'}
            onChange={(option: any) => {
                if (option) {
                    onSelect(option.value, option.label);
                } else {
                    onSelect(null, null);
                }
            }}
            loadOptions={loadOptions}
            defaultOptions={[]}
            inputValue={searchText}
            onInputChange={(text) => setSearchText(text)}
            noOptionsMessage={() => (searchText ? 'No user found.' : null)}
            {...asyncSelectProps}
            {...selectProps}
        />
    );
};

const UserSelectOptionRow: React.FC<{ user: IUserSearchResultRow }> = ({
    user,
}) => {
    const name = React.useMemo(
        () =>
            (user.fullname || '').trim() ||
            (user.username || '').trim() ||
            'No Name',
        [user]
    );
    return (
        <div className="flex-row">
            <UserAvatar tiny uid={user.id} />
            <span className="ml4">{name}</span>
        </div>
    );
};
