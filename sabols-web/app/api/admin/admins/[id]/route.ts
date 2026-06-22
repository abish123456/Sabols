import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../lib/db";
import { verifyAdminAuthWithPermission, getAdminPermissionErrorResponse, hashPasswordForStorage, getAdminIdFromRequest } from "../../../../../lib/admin-auth";
import { logAction } from "../../../../../lib/audit";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    const isAuthorized = await verifyAdminAuthWithPermission(req, 'view_admins');
    if (!isAuthorized) {
        return NextResponse.json(getAdminPermissionErrorResponse(), { status: 403 });
    }

    try {
        const resolvedParams = await Promise.resolve(context.params);
        const { id } = resolvedParams;

        const adminRes = await query(
            `SELECT id, email, username, name, active, "roleId", "createdAt", "updatedAt"
             FROM "Admin"
             WHERE id = $1`,
            [id]
        );

        if (adminRes.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Admin not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            admin: adminRes.rows[0]
        });
    } catch (error) {
        console.error("[Get Admin] Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch admin" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    const isAuthorized = await verifyAdminAuthWithPermission(req, 'edit_admins');
    if (!isAuthorized) {
        return NextResponse.json(getAdminPermissionErrorResponse(), { status: 403 });
    }

    try {
        const resolvedParams = await Promise.resolve(context.params);
        const { id } = resolvedParams;
        const body = await req.json();

        const username = (body?.username || "").toString().trim();
        const email = (body?.email || "").toString().trim();
        const name = (body?.name || "").toString().trim();
        const password = (body?.password || "").toString();
        const roleId = body?.roleId || null;
        const active = body?.active ?? true;

        if (!username || !email) {
            return NextResponse.json(
                { success: false, message: "Username and email are required" },
                { status: 400 }
            );
        }

        // Check if admin exists
        const adminRes = await query(`SELECT id, username, email, name, active, "roleId" FROM "Admin" WHERE id = $1`, [id]);
        if (adminRes.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Admin not found" },
                { status: 404 }
            );
        }
        const oldAdmin = adminRes.rows[0];

        // Check if another admin has the same username or email
        const existCheckRes = await query(
            `SELECT id FROM "Admin" WHERE (username = $1 OR email = $2) AND id != $3`,
            [username, email, id]
        );

        if (existCheckRes.rows.length > 0) {
            return NextResponse.json(
                { success: false, message: "Another admin with this username or email already exists" },
                { status: 409 }
            );
        }

        const now = new Date();

        let updateRes;
        if (password) {
            const passwordHash = hashPasswordForStorage(password);
            updateRes = await query(
                `UPDATE "Admin"
                 SET username = $1, email = $2, name = $3, "passwordHash" = $4, active = $5, "roleId" = $6, "updatedAt" = $7
                 WHERE id = $8
                 RETURNING id, username, email, name, active, "roleId"`,
                [username, email, name, passwordHash, active, roleId, now, id]
            );
        } else {
            updateRes = await query(
                `UPDATE "Admin"
                 SET username = $1, email = $2, name = $3, active = $4, "roleId" = $5, "updatedAt" = $6
                 WHERE id = $7
                 RETURNING id, username, email, name, active, "roleId"`,
                [username, email, name, active, roleId, now, id]
            );
        }

        const adminId = await getAdminIdFromRequest(req);
        logAction({
            actorId: adminId,
            actorType: 'ADMIN',
            entity: 'ADMIN',
            entityId: id,
            action: 'UPDATE',
            oldData: oldAdmin,
            newData: updateRes.rows[0],
            description: `Admin updated team member details (${name})`
        });

        return NextResponse.json({
            success: true,
            message: "Admin updated successfully",
            admin: updateRes.rows[0]
        });
    } catch (error) {
        console.error("[Update Admin] Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update admin" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    const isAuthorized = await verifyAdminAuthWithPermission(req, 'delete_admins');
    if (!isAuthorized) {
        return NextResponse.json(getAdminPermissionErrorResponse(), { status: 403 });
    }

    try {
        const resolvedParams = await Promise.resolve(context.params);
        const { id } = resolvedParams;

        // Fetch the old admin first
        const adminRes = await query(`SELECT name FROM "Admin" WHERE id = $1`, [id]);
        const oldAdmin = adminRes.rows[0];

        // Prevent deleting oneself? We could check the token, but verifyAdminAuth doesn't return the admin id directly right now in the generic check.
        // For MVP, just delete
        await query(`DELETE FROM "Admin" WHERE id = $1`, [id]);

        const adminId = await getAdminIdFromRequest(req);
        logAction({
            actorId: adminId,
            actorType: 'ADMIN',
            entity: 'ADMIN',
            entityId: id,
            action: 'DELETE',
            oldData: oldAdmin || null,
            description: `Admin deleted team member (${oldAdmin?.name || id})`
        });

        return NextResponse.json({
            success: true,
            message: "Admin deleted successfully"
        });
    } catch (error) {
        console.error("[Delete Admin] Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete admin" },
            { status: 500 }
        );
    }
}
