import React from 'react';
import moment from 'moment';
import { clone } from 'lodash';
import { useParams } from 'react-router-dom';

import ds from 'lib/datasource';
import history from 'lib/router-history';
import { generateFormattedDate } from 'lib/utils/datetime';
import { useDataFetch } from 'hooks/useDataFetch';
import { ITaskSchedule } from 'const/schedule';

import { AdminDeletedList } from './AdminDeletedList';
import { AdminAuditLogButton } from 'components/AdminAuditLog/AdminAuditLogButton';

import { TaskEditor } from 'components/Task/TaskEditor';

import { TextButton } from 'ui/Button/Button';
import { Card } from 'ui/Card/Card';
import { Icon } from 'ui/Icon/Icon';
import { Level } from 'ui/Level/Level';
import { Loading } from 'ui/Loading/Loading';
import { SimpleField } from 'ui/FormikField/SimpleField';
import { GenericCRUD } from 'ui/GenericCRUD/GenericCRUD';
import {
    TemplatedForm,
    getDefaultFormValue,
    SmartForm,
    validateForm,
    updateValue,
} from 'ui/SmartForm/SmartForm';
import { Tabs } from 'ui/Tabs/Tabs';

import './AdminMetastore.scss';

interface IAdminACLControl {
    type?: 'denylist' | 'allowlist';
    tables?: string[];
}

export interface IAdminMetastore {
    id: number;
    created_at: number;
    updated_at: number;
    deleted_at: number;
    name: string;
    metastore_params: Record<string, unknown>;
    loader: string;
    acl_control: IAdminACLControl;
}

interface IMetastoreLoader {
    name: string;
    template: TemplatedForm;
}

interface IProps {
    metastores: IAdminMetastore[];
    loadMetastores: () => Promise<any>;
}

export const AdminMetastore: React.FunctionComponent<IProps> = ({
    metastores,
    loadMetastores,
}) => {
    const { id: metastoreId } = useParams();

    const [showTaskEditor, setShowTaskEditor] = React.useState<boolean>(false);

    const {
        data: metastoreLoaders,
    }: { data: IMetastoreLoader[] } = useDataFetch<IMetastoreLoader[]>({
        url: '/admin/query_metastore_loader/',
    });

    const {
        data: metastoreUpdateSchedule,
        forceFetch: loadMetastoreUpdateSchedule,
    } = useDataFetch<ITaskSchedule>({
        url: `/schedule/name/update_metastore_${metastoreId}/`,
    });

    React.useEffect(() => {
        if (metastoreUpdateSchedule?.id) {
            setShowTaskEditor(true);
        }
    }, [metastoreUpdateSchedule]);

    const createMetastore = React.useCallback(
        async (metastore: IAdminMetastore) => {
            const { data } = await ds.save(`/admin/query_metastore/`, {
                name: metastore.name,
                metastore_params: metastore.metastore_params,
                loader: metastore.loader,
                acl_control: metastore.acl_control,
            });

            await loadMetastores();
            history.push(`/admin/metastore/${data.id}/`);

            return data as IAdminMetastore;
        },
        []
    );

    const saveMetastore = React.useCallback(
        async (metastore: Partial<IAdminMetastore>) => {
            const { data } = await ds.update(
                `/admin/query_metastore/${metastoreId}/`,
                metastore
            );

            return data as IAdminMetastore;
        },
        [metastoreId]
    );

    const deleteMetastore = React.useCallback(
        async (metastore: IAdminMetastore) =>
            ds.delete(`/admin/query_metastore/${metastore.id}/`),
        []
    );

    const recoverMetastore = React.useCallback(async (mId: number) => {
        const { data } = await ds.update(
            `/admin/query_metastore/${mId}/recover/`
        );

        await loadMetastores();
        history.push(`/admin/metastore/${mId}/`);

        return data as IAdminMetastore;
    }, []);

    const itemValidator = React.useCallback(
        (metastore: IAdminMetastore) => {
            const errors: Partial<Record<keyof IAdminMetastore, string>> = {};

            if ((metastore.name || '').length === 0) {
                errors.name = 'Name cannot be empty';
            } else if ((metastore.name || '').length > 255) {
                errors.name = 'Name is too long';
            }

            const loader = (metastoreLoaders || []).find(
                (l) => l.name === metastore.loader
            );
            if (!loader) {
                errors.loader = 'Invalid loader';
            }
            const formValid = validateForm(
                metastore.metastore_params,
                loader.template
            );
            if (!formValid[0]) {
                errors.metastore_params = `Error found in loader params ${formValid[2]}: ${formValid[1]}`;
            }

            if (metastore.acl_control.type) {
                for (const [
                    index,
                    table,
                ] of metastore.acl_control.tables.entries()) {
                    if (!table) {
                        errors.acl_control = `Table at index ${index} is empty`;
                        break;
                    }
                }
            }
            return errors;
        },
        [metastoreLoaders]
    );

    const getMetastoreACLControlDOM = (
        aclControl: IAdminACLControl,
        onChange: (fieldName: string, fieldValue: any) => void
    ) => {
        if (aclControl.type == null) {
            return (
                <div className="AdminMetastore-acl-button">
                    <TextButton
                        onClick={() =>
                            onChange('acl_control', {
                                type: 'denylist',
                                tables: [],
                            })
                        }
                        title="Create Allowlist/Denylist"
                    />
                </div>
            );
        }

        const tablesDOM = (
            <SmartForm
                formField={{
                    field_type: 'list',
                    of: {
                        description:
                            aclControl.type === 'denylist'
                                ? 'Table to Denylist'
                                : 'Table to Allowlist',
                        field_type: 'string',
                        helper: '',
                        hidden: false,
                        required: true,
                    },
                    max: null,
                    min: 1,
                }}
                value={aclControl.tables}
                onChange={(path, value) =>
                    onChange(
                        `acl_control.tables`,
                        updateValue(aclControl.tables, path, value)
                    )
                }
            />
        );
        return (
            <>
                <div className="AdminMetastore-acl-warning flex-row">
                    <Icon name="alert-octagon" />
                    {aclControl.type === 'denylist'
                        ? 'All tables will be allowed unless specified.'
                        : 'All tables will be denied unless specified.'}
                </div>
                <div className="AdminMetastore-acl-top horizontal-space-between">
                    <Tabs
                        selectedTabKey={aclControl.type}
                        items={[
                            { name: 'Denylist', key: 'denylist' },
                            { name: 'Allowlist', key: 'allowlist' },
                        ]}
                        onSelect={(key) => {
                            onChange('acl_control', { type: key, tables: [] });
                        }}
                    />
                    <TextButton
                        title={
                            aclControl.type === 'denylist'
                                ? 'Remove Denylist'
                                : 'Remove Allowlist'
                        }
                        onClick={() => onChange('acl_control', {})}
                    />
                </div>
                {tablesDOM}
            </>
        );
    };

    const renderMetastoreItem = (
        item: IAdminMetastore,
        onChange: (fieldName: string, fieldValue: any) => void
    ) => {
        const loader = (metastoreLoaders || []).find(
            (l) => l.name === item.loader
        );

        const updateLoader = (loaderName: string) => {
            const newLoader = (metastoreLoaders || []).find(
                (l) => l.name === loaderName
            );
            if (newLoader) {
                onChange(
                    'metastore_params',
                    getDefaultFormValue(newLoader.template)
                );
                onChange('loader', newLoader.name);
            }
        };

        const logDOM = item.id != null && (
            <div className="right-align">
                <AdminAuditLogButton
                    itemType="query_metastore"
                    itemId={item.id}
                />
            </div>
        );

        return (
            <>
                <div className="AdminForm-top">
                    {logDOM}
                    <SimpleField stacked name="name" type="input" />
                </div>
                <div className="AdminForm-main">
                    <div className="AdminForm-left">
                        <SimpleField
                            stacked
                            name="loader"
                            type="react-select"
                            options={Object.values(metastoreLoaders).map(
                                (l) => ({
                                    value: l.name,
                                    label: l.name,
                                })
                            )}
                            onChange={updateLoader}
                        />

                        {loader && (
                            <div className="AdminForm-section">
                                <div className="AdminForm-section-top flex-row">
                                    <div className="AdminForm-section-title">
                                        Loader Params
                                    </div>
                                    <hr className="dh-hr" />
                                </div>
                                <div className="AdminForm-section-content">
                                    <SmartForm
                                        formField={loader.template}
                                        value={item.metastore_params}
                                        onChange={(path, value) =>
                                            onChange(
                                                'metastore_params',
                                                updateValue(
                                                    item.metastore_params,
                                                    path,
                                                    value
                                                )
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        <div className="AdminForm-section">
                            <div className="AdminForm-section-top flex-row">
                                <div className="AdminForm-section-title">
                                    ACL Control
                                </div>
                                <hr className="dh-hr" />
                            </div>
                            <div className="AdminForm-section-content">
                                {getMetastoreACLControlDOM(
                                    item.acl_control,
                                    onChange
                                )}
                            </div>
                        </div>
                        {metastoreId !== 'new' && (
                            <div className="AdminForm-section">
                                <div className="AdminForm-section-top flex-row">
                                    <div className="AdminForm-section-title">
                                        Update Schedule
                                    </div>
                                    <hr className="dh-hr" />
                                </div>
                                <div className="AdminForm-section-content">
                                    {showTaskEditor ? (
                                        <div className="AdminMetastore-TaskEditor">
                                            <TaskEditor
                                                task={
                                                    metastoreUpdateSchedule ?? {
                                                        cron: '0 0 * * *',
                                                        name: `update_metastore_${metastoreId}`,
                                                        task:
                                                            'tasks.update_metastore.update_metastore',
                                                        task_type: 'prod',
                                                        enabled: true,
                                                        args: [
                                                            Number(metastoreId),
                                                        ],
                                                    }
                                                }
                                                onTaskCreate={
                                                    loadMetastoreUpdateSchedule
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <div className="AdminMetastore-TaskEditor-button center-align">
                                            <TextButton
                                                title="Create Schedule"
                                                onClick={() =>
                                                    setShowTaskEditor(true)
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    if (metastoreId === 'new') {
        if (metastoreLoaders) {
            const defaultLoader = metastoreLoaders[0];

            const newMetastore: IAdminMetastore = {
                id: null,
                created_at: moment().unix(),
                updated_at: moment().unix(),
                deleted_at: null,
                name: '',
                loader: defaultLoader.name,
                // Only StructForm form for template
                metastore_params: getDefaultFormValue(
                    defaultLoader.template
                ) as Record<string, unknown>,
                acl_control: {},
            };
            return (
                <div className="AdminMetastore">
                    <div className="AdminForm">
                        <GenericCRUD
                            item={newMetastore}
                            createItem={createMetastore}
                            renderItem={renderMetastoreItem}
                            validate={itemValidator}
                        />
                    </div>
                </div>
            );
        } else {
            return <Loading />;
        }
    }

    const metastoreItem = metastores?.find(
        (metastore) => Number(metastoreId) === metastore.id
    );

    if (
        metastoreId === 'deleted' ||
        (metastoreItem && metastoreItem.deleted_at !== null)
    ) {
        const deletedMetastores = metastoreItem?.deleted_at
            ? [metastoreItem]
            : metastores?.filter((ms) => ms.deleted_at);
        return (
            <div className="AdminMetastore">
                <div className="AdminLanding-top">
                    <div className="AdminLanding-desc">
                        Deleted metastores can be recovered.
                    </div>
                </div>
                <div className="AdminLanding-content">
                    <AdminDeletedList
                        items={deletedMetastores}
                        onRecover={recoverMetastore}
                        keysToShow={[
                            'created_at',
                            'deleted_at',
                            'loader',
                            'metastore_params',
                        ]}
                    />
                </div>
            </div>
        );
    }

    if (metastoreItem) {
        if (metastoreLoaders) {
            return (
                <div className="AdminMetastore">
                    <div className="AdminForm">
                        <GenericCRUD
                            item={metastoreItem}
                            deleteItem={deleteMetastore}
                            onDelete={() => history.push('/admin/metastore/')}
                            updateItem={saveMetastore}
                            validate={itemValidator}
                            renderItem={renderMetastoreItem}
                            onItemCUD={loadMetastores}
                        />
                    </div>
                </div>
            );
        } else {
            return <Loading />;
        }
    } else {
        const getCardDOM = () =>
            clone(metastores)
                .filter((ms) => ms.deleted_at == null)
                .sort((m1, m2) => m2.updated_at - m1.updated_at)
                .slice(0, 5)
                .map((m) => (
                    <Card
                        key={m.id}
                        title={m.name}
                        onClick={() =>
                            history.push(`/admin/metastore/${m.id}/`)
                        }
                        height="160px"
                        width="240px"
                    >
                        {' '}
                        <div className="AdminLanding-card-content">
                            <div className="AdminLanding-card-content-top">
                                Last Updated
                            </div>
                            <div className="AdminLanding-card-content-date">
                                {generateFormattedDate(m.updated_at)}
                            </div>
                        </div>
                    </Card>
                ));
        return (
            <div className="AdminMetastore">
                <div className="AdminLanding">
                    <div className="AdminLanding-top">
                        <Level>
                            <div className="AdminLanding-title">Metastore</div>
                            <AdminAuditLogButton itemType="query_metastore" />
                        </Level>
                        <div className="AdminLanding-desc">
                            Metastores hold metadata for the tables, such as
                            schemas and deny/allowlists.
                        </div>
                    </div>
                    <div className="AdminLanding-content">
                        <div className="AdminLanding-cards flex-row">
                            {metastores && getCardDOM()}
                            <Card
                                title="+"
                                onClick={() =>
                                    history.push('/admin/metastore/new/')
                                }
                                height="160px"
                                width="240px"
                            >
                                create a new metastore
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};
